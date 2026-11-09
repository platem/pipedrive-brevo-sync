#!/bin/bash
# Forced command for the fenbro-sync-logs SSH key. Install once on the VPS:
#   sudo install -m 755 scripts/sync-logs-remote.sh /usr/local/bin/sync-logs
# Add one authorized_keys line. Do not reuse an existing deploy/ops key:
#   command="/usr/local/bin/sync-logs",restrict ssh-ed25519 AAAA... fenbro-sync-logs
# The SSH user must be the user that runs PM2 (its ~/.pm2/logs holds the app logs).

set -euo pipefail
set -f

lines=50
export_mode=0
level=warn
since=""
until=""
event=""
filter=""
job=""
list=""
mode=""

LOG_DIR="${PM2_HOME:-$HOME/.pm2}/logs"
APP="pipedrive-brevo-sync"

reject() {
	echo "Rejected log query." >&2
	exit 1
}

for token in ${SSH_ORIGINAL_COMMAND-}; do
	case "$token" in
	lines=*) lines="${token#lines=}" ;;
	export=*)
		[[ "${token#export=}" == 1 ]] || reject
		export_mode=1
		;;
	level=*) level="${token#level=}" ;;
	since=*) since="${token#since=}" ;;
	until=*) until="${token#until=}" ;;
	event=*) event="${token#event=}" ;;
	filter=*) filter="${token#filter=}" ;;
	job=*) job="${token#job=}" ;;
	list=*) list="${token#list=}" ;;
	mode=*) mode="${token#mode=}" ;;
	*) reject ;;
	esac
done

# Reject leading zeros and more than twelve digits before Bash arithmetic or
# awk (integer-safe grep) reads them.
case "$lines" in
'' | *[!0-9]* | 0* | ???????????*) reject ;;
esac
max_lines=200
if ((export_mode == 1)); then
	max_lines=100000
fi
if ((lines < 1 || lines > max_lines)); then
	reject
fi
adjusted_lines=$lines

for value in "$filter" "$job" "$list"; do
	case "$value" in
	'' | [1-9]*([0-9])) ;;
	*) reject ;;
	esac
done

case "$level" in
info) level_min=0 ;;
warn) level_min=1 ;;
error) level_min=2 ;;
*) reject ;;
esac

case "$event" in
'') ;;
*[!a-z0-9_.]*) reject ;;
*) [[ ${#event} -le 64 ]] || reject ;;
esac

case "$mode" in
'' | new | overwrite) ;;
*) reject ;;
esac

since_boundary=""
until_boundary=""

iso_period() {
	case "$1" in
	[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]) printf '%s' "$1" ;;
	*) return 1 ;;
	esac
}

iso_relative() {
	# GNU date on the VPS, BSD date locally.
	if date -u -d 'now' '+%Y-%m-%dT%H:%M:%S' >/dev/null 2>&1; then
		date -u -d "$1" '+%Y-%m-%dT%H:%M:%S'
	else
		date -u -v "$2" '+%Y-%m-%dT%H:%M:%S'
	fi
}

if [[ -n "$since" ]]; then
	case "$since" in
	15m) since_boundary="$(iso_relative '15 minutes ago' -15M)" ;;
	1h) since_boundary="$(iso_relative '1 hour ago' -1H)" ;;
	6h) since_boundary="$(iso_relative '6 hours ago' -6H)" ;;
	24h) since_boundary="$(iso_relative '1 day ago' -1d)" ;;
	7d) since_boundary="$(iso_relative '7 days ago' -7d)" ;;
	*) since_boundary="$(iso_period "$since")" ;;
	esac || reject
	[[ -n "$since_boundary" ]] || reject
fi
if [[ -n "$until" ]]; then
	case "$until" in
	15m) until_boundary="$(iso_relative '15 minutes ago' -15M)" ;;
	1h) until_boundary="$(iso_relative '1 hour ago' -1H)" ;;
	6h) until_boundary="$(iso_relative '6 hours ago' -6H)" ;;
	24h) until_boundary="$(iso_relative '1 day ago' -1d)" ;;
	7d) until_boundary="$(iso_relative '7 days ago' -7d)" ;;
	*) until_boundary="$(iso_period "$until")" ;;
	esac || reject
	[[ -n "$until_boundary" ]] || reject
fi

# All filters combine with AND inside one awk pass. Values checked above are
# embedded as fixed-string checks, so no shell, grep, or awk metacharacters
# can pass through.
awk_program=$'
{
	p = index($0, "timestamp\\":");
	if (p == 0) next;
	ts = substr($0, p + 12, 19);
	if (length(ts) < 19) next;'
if [[ -n "$since_boundary" ]]; then
	awk_program+=" if (ts < \"$since_boundary\") next;"
fi
if [[ -n "$until_boundary" ]]; then
	awk_program+=" if (ts >= \"$until_boundary\") next;"
fi
awk_program+='
	lt = index($0, "level\":\"");
	lvl = -1;
	if (lt > 0) {
		name = substr($0, lt + 8, 6);
		if (substr(name, 1, 5) == "error") lvl = 2;
		else if (substr(name, 1, 4) == "warn") lvl = 1;
		else if (substr(name, 1, 4) == "info") lvl = 0;
	}
	if (lvl < '"$level_min"') next;'
if [[ -n "$event" ]]; then
	awk_program+=' if (index($0, "event\":\"'"$event"'\"") == 0) next;'
fi
for pair in "filterId$filter" "jobId$job" "brevoListId$list"; do
	key="${pair%[0-9]*}"
	: # unused scaffold; real checks added below
done
if [[ -n "$filter" ]]; then
	awk_program+=' if (index($0, "filterId\":'"$filter"',") == 0 && index($0, "filterId\":'"$filter'"}) == 0) next;'
fi
if [[ -n "$job" ]]; then
	awk_program+=' if (index($0, "jobId\":'"$job"',") == 0 && index($0, "jobId\":'"$job'"}) == 0) next;'
fi
if [[ -n "$list" ]]; then
	awk_program+=' if (index($0, "brevoListId\":'"$list"',") == 0 && index($0, "brevoListId\":'"$list'"}) == 0) next;'
fi
if [[ -n "$mode" ]]; then
	awk_program+=' if (index($0, "mode\":\"'"$mode"'\"") == 0) next;'
fi
awk_program+='
	print ts "\t" $0
}'

set +f
log_files=()
while IFS= read -r candidate; do
	log_files+=("$LOG_DIR/$candidate")
done < <(ls -1 "$LOG_DIR" 2>/dev/null | grep -E "^$APP-(out|error)-[0-9]+\.log$" | sort)
if ((${#log_files[@]} == 0)); then
	exit 0
fi

cat "${log_files[@]}" \
	| awk "$awk_program" \
	| LC_ALL=C sort \
	| tail -n "$adjusted_lines" \
	| cut -f2-
exit 0

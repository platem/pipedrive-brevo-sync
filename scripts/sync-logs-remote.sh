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

# Reject leading zeros and absurd digit counts before Bash arithmetic reads them.
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
	'') ;;
	*[!0-9]*) reject ;;
	0*) reject ;;
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

resolve_boundary() {
	case "$1" in
	15m) iso_relative '15 minutes ago' -15M ;;
	1h) iso_relative '1 hour ago' -1H ;;
	6h) iso_relative '6 hours ago' -6H ;;
	24h) iso_relative '1 day ago' -1d ;;
	7d) iso_relative '7 days ago' -7d ;;
	*) iso_period "$1" ;;
	esac
}

if [[ -n "$since" ]]; then
	since_boundary="$(resolve_boundary "$since")" || reject
	[[ -n "$since_boundary" ]] || reject
fi
if [[ -n "$until" ]]; then
	until_boundary="$(resolve_boundary "$until")" || reject
	[[ -n "$until_boundary" ]] || reject
fi

# All filters combine with AND in one awk pass. Option values are passed with
# -v, so they are data: no shell, grep, or awk metacharacters can take effect.
awk_program='
function has_id(line, key, value) {
	if (value == "") return 1;
	needle = "\"" key "\":" value;
	pos = index(line, needle);
	if (pos == 0) return 0;
	next_char = substr(line, pos + length(needle), 1);
	return (next_char == "," || next_char == "}");
}
{
	p = index($0, "timestamp\":\"");
	if (p == 0) next;
	ts = substr($0, p + 12, 19);
	if (length(ts) < 19) next;
	if (since != "" && ts < since) next;
	if (until != "" && ts >= until) next;

	lvl = -1;
	if (index($0, "level\":\"error\"") > 0) lvl = 2;
	else if (index($0, "level\":\"warn\"") > 0) lvl = 1;
	else if (index($0, "level\":\"info\"") > 0) lvl = 0;
	if (lvl < level_min) next;

	if (event != "" && index($0, "event\":\"" event "\"") == 0) next;
	if (mode != "" && index($0, "mode\":\"" mode "\"") == 0) next;
	if (!has_id($0, "filterId", filter)) next;
	if (!has_id($0, "jobId", job)) next;
	if (!has_id($0, "brevoListId", list)) next;

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

cat "${log_files[@]}" | awk \
	-v level_min="$level_min" \
	-v since="$since_boundary" \
	-v until="$until_boundary" \
	-v event="$event" \
	-v mode="$mode" \
	-v filter="$filter" \
	-v job="$job" \
	-v list="$list" \
	"$awk_program" | LC_ALL=C sort | tail -n "$adjusted_lines" | cut -f2-
exit 0

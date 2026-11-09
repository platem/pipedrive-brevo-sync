#!/usr/bin/env node
// Read a capped slice of the production pipedrive-brevo-sync logs.
// The server-side forced command (scripts/sync-logs-remote.sh) is the guard.

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const LOG_DIR = path.join(REPO_ROOT, 'tmp', 'logs');
const RELATIVE_PERIODS = new Set(['15m', '1h', '6h', '24h', '7d']);
const ABSOLUTE_PERIOD = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const LEVELS = new Set(['error', 'warn', 'info']);
const EVENT_PATTERN = /^[a-z0-9_.]{1,64}$/;
const ID_PATTERN = /^\d{1,12}$/;
const MODES = new Set(['new', 'overwrite']);
const MAX_LINES = 200;
const MAX_EXPORT_LINES = 100000;

const HELP = `Read the production pipedrive-brevo-sync sync logs.

This command opens one SSH session to the host configured for the alias
fenbro-sync-logs and prints matching structured sync log lines. Run it again
with a tighter filter after you read the first result.

Usage (from the repository root):
  bun run logs [options]

Options:
  --since <period>   Include lines at or after this time. Optional.
                     Relative: 15m, 1h, 6h, 24h, 7d
                     Absolute UTC: YYYY-MM-DDThh:mm:ssZ
  --until <period>   Include lines before this time. Same forms as --since.
  --level <level>    Keep one severity or higher: error, warn, or info. Default warn.
  --event <name>     Keep one event, for example brevo.clear. Optional.
  --filter <id>      Keep one Pipedrive filter ID, for example 177387. Optional.
  --job <id>         Keep one sync job ID from a log line. Optional.
  --list <id>        Keep one Brevo list ID, for example 412. Optional.
  --mode <mode>      Keep one mode: new or overwrite. Optional.
  --lines <count>    How many matching lines to print. 1 to 200. Default 50.
                     With --export: 1 to 100000. Default 100000.
  --export <file>    Write the lines to a .ndjson file in tmp/logs/. Do not print them.
  --help             Print this text and exit.

The filters combine with AND. A line must match all the filters that you give.
A period selects the time range. --lines selects the size of the result.
--since 7d still prints at most 200 lines.

Default: the latest 50 warnings and errors. Start here when the report is only
that something failed.

What it returns:
  stdout is log text, oldest of the selected lines first. Every returned line is
  one JSON object with "timestamp", "level", "event", "stage", and correlation
  IDs when known ("filterId", "jobId", "brevoListId", "mode").
  Empty stdout means the query ran and no line matched.
  With --export, stdout has one line: "Wrote <N> lines to <relative path>".
  Exit 0 means the query ran. Exit 1 means the arguments are invalid or the SSH
  session failed. The SSH error is on stderr.

What it does not do:
  It does not print every line in the period.
  It does not read the database, the environment file, or the disk.
  It does not restart the application or change anything on the server.
  It does not accept a host, a user, or a key path. Those stay in the local
  SSH config for the alias fenbro-sync-logs.
  It does not write an export file outside tmp/logs/.

How to narrow:
  1. bun run logs
  2. bun run logs --event <event from a line>
  3. bun run logs --filter <filterId from a line> --level info
  To read one job, run bun run logs --level info --job <jobId from a line>.
  To read an earlier page, copy the oldest timestamp from the result and pass
  it as --until while keeping the other filters.
`;

const optionParsers = {
	since: (value) => period('since', value),
	until: (value) => period('until', value),
	level,
	event: eventName,
	filter: idName('filter'),
	job: idName('job'),
	list: idName('list'),
	mode: modeName,
	lines: lineCount,
	export: exportFile
};

function parseArgs(argv) {
	const query = { help: false, level: 'warn' };
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === '--help') {
			query.help = true;
			continue;
		}
		const name = optionName(token);
		const value = argv[index + 1];
		if (value === undefined || value.startsWith('--')) {
			throw new Error(`--${name} requires a value`);
		}
		index += 1;
		const parse = optionParsers[name];
		if (!parse) throw new Error(`Unknown option: --${name}`);
		query[name] = parse(value);
	}
	if (!query.help) applyLineLimit(query);
	return query;
}

function optionName(token) {
	if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
	return token.slice(2);
}

function period(name, value) {
	if (RELATIVE_PERIODS.has(value) || ABSOLUTE_PERIOD.test(value)) return value;
	throw new Error(`--${name} must be 15m, 1h, 6h, 24h, 7d, or YYYY-MM-DDThh:mm:ssZ`);
}

function level(value) {
	if (!LEVELS.has(value)) throw new Error('--level must be error, warn, or info');
	return value;
}

function eventName(value) {
	if (!EVENT_PATTERN.test(value))
		throw new Error('--event must contain only lowercase letters, digits, dots, and underscores');
	return value;
}

function idName(name) {
	return (value) => {
		if (!ID_PATTERN.test(value)) throw new Error(`--${name} must be a numeric ID`);
		return value;
	};
}

function modeName(value) {
	if (!MODES.has(value)) throw new Error('--mode must be new or overwrite');
	return value;
}

function lineCount(value) {
	if (!/^\d+$/.test(value)) throw new Error('--lines must be an integer');
	return Number(value);
}

function exportFile(value) {
	const resolved = path.resolve(REPO_ROOT, value);
	const inside = path.relative(LOG_DIR, resolved);
	if (
		inside === '' ||
		inside === '..' ||
		inside.startsWith(`..${path.sep}`) ||
		path.isAbsolute(inside) ||
		!resolved.endsWith('.ndjson')
	) {
		throw new Error('--export must name a .ndjson file inside tmp/logs/');
	}
	return { resolved, relative: path.relative(REPO_ROOT, resolved) };
}

function applyLineLimit(query) {
	const maximum = query.export ? MAX_EXPORT_LINES : MAX_LINES;
	if (query.lines === undefined) query.lines = query.export ? MAX_EXPORT_LINES : 50;
	if (query.lines < 1 || query.lines > maximum) {
		throw new Error(`--lines must be an integer from 1 to ${maximum}`);
	}
}

function remoteCommand(query) {
	const tokens = [`lines=${query.lines}`, `level=${query.level}`];
	if (query.since) tokens.push(`since=${query.since}`);
	if (query.until) tokens.push(`until=${query.until}`);
	if (query.event) tokens.push(`event=${query.event}`);
	if (query.filter) tokens.push(`filter=${query.filter}`);
	if (query.job) tokens.push(`job=${query.job}`);
	if (query.list) tokens.push(`list=${query.list}`);
	if (query.mode) tokens.push(`mode=${query.mode}`);
	if (query.export) tokens.push('export=1');
	return tokens;
}

function startQuery(query) {
	return spawn(
		'ssh',
		[
			'-o',
			'BatchMode=yes',
			'-o',
			'IdentitiesOnly=yes',
			'-o',
			'ClearAllForwardings=yes',
			'fenbro-sync-logs',
			...remoteCommand(query)
		],
		{ stdio: query.export ? ['ignore', 'pipe', 'inherit'] : 'inherit' }
	);
}

function createNewlineCounter() {
	let lines = 0;
	const stream = new Transform({
		transform(chunk, encoding, callback) {
			for (const byte of chunk) {
				if (byte === 0x0a) lines += 1;
			}
			this.partial = chunk.at(-1) !== 0x0a;
			callback(null, chunk);
		},
		flush(callback) {
			if (this.partial) lines += 1;
			callback();
		}
	});
	return { stream, count: () => lines };
}

async function run() {
	const args = process.argv.slice(2);
	let query;
	try {
		query = parseArgs(args);
	} catch (err) {
		console.error(err instanceof Error ? err.message : String(err));
		console.error('Run with --help for usage.');
		process.exitCode = 1;
		return;
	}
	if (query.help) {
		console.log(HELP);
		return;
	}
	if (query.export) {
		const child = startQuery(query);
		const counter = createNewlineCounter();
		child.on('error', () => {
			process.exitCode = 1;
		});
		child.on('close', (code) => {
			if (code !== 0) process.exitCode = code ?? 1;
		});
		try {
			await mkdir(LOG_DIR, { recursive: true });
			await mkdir(path.dirname(query.export.resolved), { recursive: true });
			await pipeline(child.stdout, counter.stream, createWriteStream(query.export.resolved));
			console.log(`Wrote ${counter.count()} lines to ${query.export.relative}`);
		} catch (err) {
			console.error(err instanceof Error ? err.message : String(err));
			process.exitCode = 1;
		}
		return;
	}
	const child = startQuery(query);
	child.on('error', () => {
		process.exitCode = 1;
	});
	child.on('close', (code) => {
		if (code !== 0 && code !== null) process.exitCode = code;
	});
}

await run();

import { readFileSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(__dirname);

export type FixtureData = unknown;

export function readFixture(filename: string): FixtureData {
	const filePath = join(FIXTURES_DIR, filename);
	const content = readFileSync(filePath, 'utf-8');
	return JSON.parse(content);
}

export function createJsonResponse(
	data: unknown,
	status = 200
): { status: number; headers: Record<string, string>; json: () => unknown } {
	return {
		status,
		headers: { 'Content-Type': 'application/json' },
		json: () => data
	};
}

export function createErrorResponse(
	message: string,
	status = 500
): { status: number; headers: Record<string, string>; json: () => unknown } {
	return {
		status,
		headers: { 'Content-Type': 'application/json' },
		json: () => ({ error: message })
	};
}

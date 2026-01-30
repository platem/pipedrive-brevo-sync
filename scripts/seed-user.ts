import { hash } from '@node-rs/argon2';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/lib/server/db/schema';
import * as table from '../src/lib/server/db/schema';

const args = process.argv.slice(2);

if (args.length < 2) {
	console.error('Usage: bun scripts/seed-user.ts <username> <password>');
	process.exit(1);
}

const [username, password] = args;

async function main() {
	const dbUrl = process.env.DATABASE_URL || 'sqlite.db';
	const client = new Database(dbUrl);
	const db = drizzle(client, { schema });

	const existingUser = db.select().from(table.user).all();

	if (existingUser.length > 0) {
		console.error('User already exists. Only one user is supported.');
		process.exit(1);
	}

	const passwordHash = await hash(password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});

	const bytes = crypto.getRandomValues(new Uint8Array(15));
	const userId = encodeBase32LowerCase(bytes);

	db.insert(table.user).values({ id: userId, username, passwordHash }).run();

	console.log(`User "${username}" created successfully with ID: ${userId}`);

	client.close();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

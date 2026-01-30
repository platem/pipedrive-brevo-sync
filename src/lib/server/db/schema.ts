import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const user = sqliteTable('user', {
	id: text('id').primaryKey()
});

export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
	},
	(table) => ({
		idxSessionUserId: index('idx_session_user_id').on(table.userId),
		idxSessionExpiresAt: index('idx_session_expires_at').on(table.expiresAt)
	})
);

export const filters = sqliteTable(
	'filters',
	{
		id: integer('id').primaryKey(), // Pipedrive Filter ID
		name: text('name').notNull(),
		brevoListId: integer('brevo_list_id'),
		deletedAt: integer('deleted_at', { mode: 'timestamp' })
	},
	(table) => ({
		idxFiltersDeletedAt: index('idx_filters_deleted_at').on(table.deletedAt)
	})
);

export const syncJobs = sqliteTable(
	'sync_jobs',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		filterId: integer('filter_id')
			.notNull()
			.references(() => filters.id, { onDelete: 'cascade' }),
		status: text('status').notNull(), // 'processing', 'completed', 'failed'
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		completedAt: integer('completed_at', { mode: 'timestamp' }),
		totalFetched: integer('total_fetched').default(0),
		totalAdded: integer('total_added').default(0),
		errorMessage: text('error_message')
	},
	(table) => ({
		idxSyncJobsFilterId: index('idx_sync_jobs_filter_id').on(table.filterId),
		idxSyncJobsStatus: index('idx_sync_jobs_status').on(table.status),
		idxSyncJobsCreatedAt: index('idx_sync_jobs_created_at').on(table.createdAt)
	})
);

export type Session = typeof session.$inferSelect;
export type User = typeof user.$inferSelect;
export type Filter = typeof filters.$inferSelect;
export type SyncJob = typeof syncJobs.$inferSelect;

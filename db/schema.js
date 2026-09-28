import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';
export const formatFeedback = sqliteTable('format_feedback', {
  scoreHash: text('score_hash').notNull(),
  profile: text('profile').notNull(),
  major: integer('major').notNull(),
  revision: integer('revision').notNull(),
  worked: integer('worked',{mode:'boolean'}).notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [primaryKey({columns:[table.scoreHash,table.profile]})]);

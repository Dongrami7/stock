import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
export const snapshots = sqliteTable('snapshots', {
 id:text('id').notNull(), owner:text('owner').notNull(), hash:text('hash').notNull(), created:text('created').notNull(), data:text('data').notNull()
},t=>[primaryKey({columns:[t.owner,t.id]})]);
export const watches = sqliteTable('watches', {
 owner:text('owner').notNull(), code:text('code').notNull(), data:text('data').notNull()
},t=>[primaryKey({columns:[t.owner,t.code]})]);
export const providerCache = sqliteTable('provider_cache', {key:text('key').primaryKey(),meta:text('meta').notNull()});
export const observations = sqliteTable('observations', {owner:text('owner').notNull(),id:text('id').notNull(),created:text('created').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.owner,t.id]})]);

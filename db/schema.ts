import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const sessions=sqliteTable('sessions',{id:text('id').primaryKey(),createdAt:integer('created_at').notNull()});
export const rooms=sqliteTable('rooms',{code:text('code').primaryKey(),host:text('host').notNull(),status:text('status').notNull(),revision:integer('revision').notNull().default(0),state:text('state').notNull(),updatedAt:integer('updated_at').notNull()},t=>[index('rooms_host_idx').on(t.host)]);
export const seats=sqliteTable('seats',{id:text('id').primaryKey(),room:text('room').notNull(),session:text('session').notNull(),seat:integer('seat').notNull()},t=>[index('seats_session_idx').on(t.session)]);

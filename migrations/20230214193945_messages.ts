import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	return knex.schema.createTable('messages', (table) => {
		table.increments('id').notNullable();
		table.increments('channelId', { primaryKey: false }).notNullable().references('channels.id').onDelete('cascade');
		table.increments('authorId', { primaryKey: false }).notNullable().references('users.id');
		table.string('content', 2000).notNullable();
		table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.dropTable('messages');
}


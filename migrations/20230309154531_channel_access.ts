import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	return knex.schema.createTable('channel_access', (table) => {
		table.increments('userId', { primaryKey: false }).notNullable().references('users.id');
		table.increments('channelId', { primaryKey: false }).notNullable().references('channels.id').onDelete('cascade');
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.dropTable('channel_access');
}


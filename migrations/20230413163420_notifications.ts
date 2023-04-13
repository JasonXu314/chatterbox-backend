import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('friend_notifications', (table) => {
		table.increments('user', { primaryKey: false }).references('users.id').notNullable();
		table.increments('from', { primaryKey: false }).references('users.id').notNullable();
		table.increments('to', { primaryKey: false }).references('users.id').notNullable();
	});

	await knex.schema.createTable('message_notifications', (table) => {
		table.increments('user', { primaryKey: false }).references('users.id').notNullable();
		table.increments('channelId', { primaryKey: false }).references('channels.id').notNullable();
		table.integer('count').notNullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTable('friend_notifications');
	await knex.schema.dropTable('message_notifications');
}


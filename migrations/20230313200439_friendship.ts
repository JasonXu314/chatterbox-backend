import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('friend', (table) => {
		table.increments('sender', { primaryKey: false }).references('users.id');
		table.increments('recipient', { primaryKey: false }).references('users.id');
		table.increments('channelId', { primaryKey: false }).references('channels.id');
	});

	await knex.schema.createTable('blocked', (table) => {
		table.increments('blocker', { primaryKey: false }).references('users.id');
		table.increments('blocked', { primaryKey: false }).references('users.id');
	});

	await knex.schema.createTable('friend_request', (table) => {
		table.increments('fromId', { primaryKey: false }).references('users.id');
		table.increments('toId', { primaryKey: false }).references('users.id');
		table.timestamp('requestedAt', { precision: 6 }).defaultTo(knex.fn.now(6)).notNullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTable('friend_request');
	await knex.schema.dropTable('blocked');
	await knex.schema.dropTable('friend');
}


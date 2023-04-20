import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('users', (table) => {
		table.increments('id').notNullable();
		table.string('username', 12).notNullable().unique();
		table.string('password').notNullable();
		table.string('salt').notNullable();
		table.string('token').notNullable().unique();
		table.string('email').notNullable().unique();
		table.string('avatar').notNullable().unique();
		table.boolean('emailVerified').notNullable().defaultTo(false);
		table.enum('status', ['ONLINE', 'OFFLINE', 'IDLE', 'DO_NOT_DISTURB', 'INVISIBLE']).notNullable().defaultTo('OFFLINE');
	});

	await knex.schema.createTable('settings', (table) => {
		table.increments('id', { primaryKey: false }).notNullable().references('users.id');
		table.enum('notifications', ['ALL', 'MESSAGES', 'FRIEND_REQ', 'NONE']).notNullable().defaultTo('ALL');
		table.boolean('lightMode').notNullable().defaultTo(false);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTable('settings');
	return knex.schema.dropTable('users');
}


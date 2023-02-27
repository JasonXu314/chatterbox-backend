import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	if (await knex.schema.hasTable('users')) {
		await knex.schema.dropViewIfExists('user_view');
		await knex.schema.dropTable('users');
	}

	return knex.schema.createTable('users', (table) => {
		table.increments('id').notNullable();
		table.string('username').notNullable().unique();
		table.string('password').notNullable();
		table.string('salt').notNullable();
		table.string('token').notNullable().unique();
		table.string('email').notNullable().unique();
		table.string('avatar').notNullable().unique();
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.dropTable('users');
}


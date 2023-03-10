import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	return knex.schema.table('channels', (table) => {
		table.string('type').defaultTo('public').notNullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.table('channels', (table) => {
		table.dropColumn('type');
	});
}


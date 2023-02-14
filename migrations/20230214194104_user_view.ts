import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	return knex.schema.createViewOrReplace('user_view', (view) => {
		view.columns(['id', 'username', 'avatar']);
		view.as(knex('users').select('id', 'username', 'avatar'));
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.dropView('user_view');
}


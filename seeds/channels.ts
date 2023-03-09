import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
	// Deletes ALL existing entries
	await knex('channel_access').del();
	await knex('messages').del();
	await knex('channels').del();

	// Inserts seed entries
	await knex('channels').insert({ id: 0, name: 'public' });
}


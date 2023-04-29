import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
	// Deletes ALL existing entries
	await knex('channel_access').del();
	await knex('messages').del();
	await knex('channels').del();

	// Inserts seed entries
	await knex('channels').insert({ name: 'general', type: 'public' });
	await knex('channels').insert({ name: 'school', type: 'public' });
	await knex('channels').insert({ name: 'sports', type: 'public' });
	await knex('channels').insert({ name: 'gaming', type: 'public' });
	await knex('channels').insert({ name: 'politics', type: 'public' });
}


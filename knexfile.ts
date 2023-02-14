import * as dotenv from 'dotenv';
import type { Knex } from 'knex';

dotenv.config();

// Update with your config settings.

const config: { [key: string]: Knex.Config } = {
	development: {
		client: 'mysql2',
		connection: {
			host: '127.0.0.1',
			port: 3306,
			user: 'root',
			password: process.env.DB_PASSWORD,
			database: 'main'
		},
		migrations: {
			tableName: 'knex_migrations'
		}
	},
	staging: {
		client: 'mysql2',
		connection: process.env.MAIN_DATABASE_DSN,
		migrations: {
			tableName: 'knex_migrations'
		}
	},
	production: {
		client: 'mysql2',
		connection: process.env.MAIN_DATABASE_DSN,
		migrations: {
			tableName: 'knex_migrations'
		}
	}
};

module.exports = config;


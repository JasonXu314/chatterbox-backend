import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Knex, knex } from 'knex';
import { CreateUserDTO } from './users/User.dto';
import { User } from './users/User.model';

@Injectable()
export class DBService {
	private _db: Promise<Knex>;
	private _logger: Logger;

	constructor() {
		this._logger = new Logger('DBService');

		const db = knex({
			client: 'mysql2',
			connection: {
				host: '127.0.0.1',
				port: 3306,
				user: 'root',
				password: process.env.DB_PASSWORD,
				database: 'main'
			}
		});

		this._db = Promise.all([
			db.schema.hasTable('users').then((exists) => {
				if (!exists) {
					return db.schema.createTable('users', (table) => {
						table.increments('id').notNullable();
						table.string('username').notNullable().unique();
						table.string('password').notNullable();
						table.string('salt').notNullable();
					});
				}
			})
		]).then(() => {
			this._logger.log('db initialized');
			return db;
		});
	}

	public async getUsers(id?: number | undefined): Promise<User[]> {
		const db = await this._db;

		if (id) {
			return db<User>('users').where({ id });
		} else {
			return db<User>('users');
		}
	}

	public async getUserByName(username: string): Promise<User | null> {
		const db = await this._db;

		const [user] = await db<User>('users').where({ username });

		return user || null;
	}

	public async createUser(user: CreateUserDTO): Promise<User> {
		const db = await this._db;

		const salt = randomBytes(16).toString('hex');
		const hashedPassword = createHash('sha256')
			.update(user.password + salt)
			.digest('hex');

		const newUser: Omit<User, 'id'> = { ...user, password: hashedPassword, salt };

		return db.transaction(async (trx) => {
			const [id] = await trx.insert(newUser).into('users');

			return { ...newUser, id };
		});
	}
}


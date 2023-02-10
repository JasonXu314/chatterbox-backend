import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Knex, knex } from 'knex';
import { Message } from 'src/models/Message.model';
import { CreateUserDTO } from '../models/User.dto';
import { PublicUser, User } from '../models/User.model';

@Injectable()
export class DBService {
	private _db: Promise<Knex>;
	private _logger: Logger;

	constructor() {
		this._logger = new Logger('DBService');

		const db = knex({
			client: 'mysql2',
			connection: process.env.MAIN_DATABASE_DSN || {
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
					return db.schema.createTable('users', this.defineUsersTable);
				} else {
					return db.transaction(async () => {
						await db.schema.dropTable('users');
						return db.schema.createTable('users', this.defineUsersTable);
					});
				}
			}),
			db.schema.hasTable('channels').then((exists) => {
				if (!exists) {
					return db.schema.createTable('channels', (table) => {
						table.increments('id').notNullable();
						table.string('name').notNullable().unique();
					});
				}
			}),
			db.schema.hasTable('messages').then((exists) => {
				if (!exists) {
					return db.schema.createTable('messages', (table) => {
						table.increments('id').notNullable();
						table.integer('channelId').notNullable().references('channels.id');
						table.integer('authorId').notNullable().references('users.id');
						table.string('content').notNullable();
						table.timestamp('createdAt').notNullable().defaultTo(db.fn.now());
					});
				}
			})
		])
			.then(() =>
				Promise.all([
					db.schema.createViewOrReplace('user_view', (view) => {
						view.columns(['id', 'username']);
						view.as(db('users').select('id', 'username'));
					}),
					db('channels').insert({ name: 'public' })
				])
			)
			.then(() => {
				this._logger.log('DB initialized');
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

	public async getPublicUsers(id?: number | undefined): Promise<PublicUser[]> {
		const db = await this._db;

		if (id) {
			return db<PublicUser>('user_view').where({ id });
		} else {
			return db<PublicUser>('user_view');
		}
	}

	public async getUserById(id: number): Promise<User | null> {
		const db = await this._db;

		const [user] = await db<User>('users').where({ id });

		return user || null;
	}

	public async getUserByName(username: string): Promise<User | null> {
		const db = await this._db;

		const [user] = await db<User>('users').where({ username });

		return user || null;
	}

	public async getUserByToken(token: string): Promise<User | null> {
		const db = await this._db;

		const [user] = await db<User>('users').where({ token });

		return user || null;
	}

	public async createUser(user: CreateUserDTO): Promise<User> {
		const db = await this._db;

		const salt = randomBytes(16).toString('hex');
		const hashedPassword = createHash('sha256')
			.update(user.password + salt)
			.digest('hex');
		const token = randomBytes(32).toString('hex');

		const newUser: Omit<User, 'id'> = { ...user, password: hashedPassword, salt, token };

		return db.transaction(async (trx) => {
			const [id] = await trx.insert(newUser).into('users');

			return { ...newUser, id };
		});
	}

	public async getMessages(channelId: number): Promise<Message[]> {
		const db = await this._db;

		return db<Message>('messages').where({ channelId });
	}

	public async createMessage(author: User, content: string, channelId: number): Promise<Message> {
		const db = await this._db;

		const newMessage: Omit<Message, 'id' | 'createdAt'> = {
			channelId,
			authorId: author.id,
			content
		};

		return db.transaction(async (trx) => {
			const [id] = await trx.insert(newMessage).into('messages');

			return trx<Message>('messages').where({ id }).first();
		});
	}

	private defineUsersTable(table: Knex.CreateTableBuilder): void {
		table.increments('id').notNullable();
		table.string('username').notNullable().unique();
		table.string('password').notNullable();
		table.string('salt').notNullable();
		table.string('token').notNullable().unique();
	}
}


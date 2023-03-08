import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Knex, knex } from 'knex';
import { Message } from 'src/models/Message.model';
import { CreateUserDTO } from '../models/User.dto';
import { PublicUser, User } from '../models/User.model';

@Injectable()
export class DBService {
	private readonly _db: Knex;
	private readonly _logger: Logger;

	constructor() {
		this._logger = new Logger('DBService');

		this._db = knex({
			client: 'mysql2',
			connection: process.env.MAIN_DATABASE_DSN || {
				host: '127.0.0.1',
				port: 3306,
				user: 'root',
				password: process.env.DB_PASSWORD,
				database: 'main'
			}
		});
	}

	public async getUsers(id?: number | undefined): Promise<User[]> {
		if (id) {
			return this._db<User>('users').where({ id });
		} else {
			return this._db<User>('users');
		}
	}

	public async getPublicUsers(id?: number | undefined): Promise<PublicUser[]> {
		if (id) {
			return this._db<PublicUser>('user_view').where({ id });
		} else {
			return this._db<PublicUser>('user_view');
		}
	}

	public async getUserById(id: number): Promise<User | null> {
		const [user] = await this._db<User>('users').where({ id });

		return user || null;
	}

	public async getUserByName(username: string): Promise<User | null> {
		const [user] = await this._db<User>('users').where({ username });

		return user || null;
	}

	public async getUserByToken(token: string): Promise<User | null> {
		const [user] = await this._db<User>('users').where({ token });

		return user || null;
	}

	public async getUserByEmail(email: string): Promise<User | null> {
		const [user] = await this._db<User>('users').where({ email });

		return user || null;
	}

	public async createUser(user: CreateUserDTO): Promise<User> {
		const salt = randomBytes(16).toString('hex');
		const hashedPassword = createHash('sha256')
			.update(user.password + salt)
			.digest('hex');
		const token = randomBytes(32).toString('hex');

		const newUser: Omit<User, 'id'> = {
			...user,
			password: hashedPassword,
			salt,
			token,
			avatar: `https://ui-avatars.com/api?name=${encodeURIComponent(user.username)}&background=random&length=1`
		};

		return this._db.transaction(async (trx) => {
			const [id] = await trx.insert(newUser).into('users');

			return { ...newUser, id };
		});
	}

	public async getMessages(channelId: number): Promise<Message[]> {
		return this._db<Message>('messages').where({ channelId });
	}

	public async createMessage(author: User, content: string, channelId: number): Promise<Message> {
		const newMessage: Omit<Message, 'id' | 'createdAt'> = {
			channelId,
			authorId: author.id,
			content
		};

		return this._db.transaction(async (trx) => {
			const [id] = await trx.insert(newMessage).into('messages');

			return trx<Message>('messages').where({ id }).first();
		});
	}

	public async setAvatar(user: User, avatarUrl: string): Promise<boolean> {
		return this._db.transaction(async (trx) => {
			await trx<User>('users').update({ avatar: avatarUrl }).where({ id: user.id });

			return true;
		});
	}
}


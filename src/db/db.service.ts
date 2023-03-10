import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Knex, knex } from 'knex';
import { Channel } from 'src/models/Channel.model';
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

			const [publicChannel] = await trx.select('id').from('channels').where({ type: 'public' });
			await trx.insert({ userId: id, channelId: publicChannel.id }).into('channel_access');

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

	public async getChannels(userToken: string): Promise<Channel[]> {
		const [user] = await this._db.select('id').from('users').where({ token: userToken });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		const db = this._db;

		return this._db
			.select('id', 'name', 'type')
			.from('channels')
			.leftJoin('channel_access', function () {
				this.on('channel_access.channelId', '=', 'channels.id').andOn('channel_access.userId', '=', db.raw('?', [user.id]));
			});
	}

	public async getFriends(userToken: string): Promise<(PublicUser & { channelId: number })[]> {
		const [user] = await this._db.select('id').from('users').where({ token: userToken });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		const relations = await this._db.select('sender', 'recipient', 'channelId').from('friend').where({ sender: user.id });

		const friendUsers = await this._db
			.select('id', 'username', 'avatar')
			.from('users')
			.whereIn(
				'id',
				relations.map(({ recipient }) => recipient)
			);

		return friendUsers.map((user) => ({ ...user, channelId: relations.find(({ recipient }) => recipient === user.id).channelId }));
	}

	public async makeFriendRequest(token: string, friendId: number): Promise<void> {
		const [user] = await this._db.select('id').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		if (user.id === friendId) {
			throw new BadRequestException('Requested friend is reqesting user');
		}

		return this._db.transaction(async (trx) => {
			await trx<{ fromId: number; toId: number }>('friend_request').insert({ fromId: user.id, toId: friendId });
		});
	}

	public async acceptFriendRequest(token: string, friendId: number): Promise<PublicUser & { channelId: number }> {
		const [user] = await this._db.select('id', 'username').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		if (user.id === friendId) {
			throw new BadRequestException('Requested friend is reqesting user');
		}

		const [request] = await this._db.select('fromId', 'toId', 'requestedAt').from('friend_request').where({ fromId: friendId, toId: user.id });

		if (!request) {
			throw new BadRequestException('There does not exist an outstanding friend request from that user');
		}

		return this._db.transaction(async (trx) => {
			const [newFriend] = await trx.select('id', 'username', 'avatar').from('users').where({ id: request.fromId });

			const [channelId] = await trx.insert({ name: `${newFriend.username}-${user.username}`, type: 'direct' }).into('channels');
			await trx.insert({ sender: newFriend.id, recipient: user.id, channelId }).into('friend');
			await trx.insert({ sender: user.id, recipient: newFriend.id, channelId }).into('friend');

			await trx.insert({ userId: user.id, channelId }).into('channel_access');
			await trx.insert({ userId: newFriend.id, channelId }).into('channel_access');

			await trx.delete().from('friend_request').where(request);

			return { ...newFriend, channelId };
		});
	}
}


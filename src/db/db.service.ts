import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Knex, knex } from 'knex';
import { Channel } from 'src/models/Channel.model';
import { FriendRequestResponseDTO } from 'src/models/FriendRequest.dto';
import { MessageDTO } from 'src/models/Message.dto';
import { Message } from 'src/models/Message.model';
import { FriendNotificationDTO, FriendNotificationType, MessageNotificationDTO } from 'src/models/Notifications.dto';
import { FriendNotification, MessageNotification } from 'src/models/Notifications.model';
import { CreateUserDTO, FilterMethod } from '../models/User.dto';
import { AppUser, Friend, NotificationsSetting, PublicUser, User, UserStatus } from '../models/User.model';

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

	public async setStatus(id: number, status: UserStatus): Promise<void> {
		await this._db('users').update({ status }).where({ id });
	}

	public async getAllNotifications(): Promise<(FriendNotification | MessageNotification)[]> {
		const fns = await this._db('friend_notifications');
		const mns = await this._db('message_notifications');
		return [...fns, ...mns];
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
			avatar: `https://ui-avatars.com/api?name=${encodeURIComponent(user.username)}&background=${this._generateRandomColor()}&length=1`,
			status: 'OFFLINE'
		};

		return this._db.transaction(async (trx) => {
			const [id] = await trx.insert(newUser).into('users');

			const [publicChannel] = await trx.select('id').from('channels').where({ type: 'public' });
			await trx.insert({ userId: id, channelId: publicChannel.id }).into('channel_access');

			return { ...newUser, id };
		});
	}

	public async updateEmail(token: string, email: string): Promise<void> {
		const [user] = await this._db.select('id').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		await this._db('users').update({ email }).where({ id: user.id });
	}

	public async updateUser(token: string, settings: { status?: UserStatus; notifications?: NotificationsSetting; lightMode?: boolean }): Promise<AppUser> {
		const [user] = await this._db.select('id').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		if (settings.status !== undefined) {
			if (settings.notifications !== undefined || settings.lightMode !== undefined) {
				await this._db('users').update({ status: settings.status });
			} else {
				return this._db.transaction(async (trx) => {
					await trx('users').update({ status: settings.status }).where({ id: user.id });
					return (await trx.select('id', 'username', 'token', 'avatar', 'email').from('users').where({ id: user.id }))[0];
				});
			}
		}

		return this._db.transaction(async (trx) => {
			const updates: any = {};

			if (settings.notifications !== undefined) {
				// paranoid about undefined stuff being recognized by knex or not, so manually apply updates
				updates.notifications = settings.notifications;
			}
			if (settings.lightMode !== undefined) {
				updates.lightMode = settings.lightMode;
			}

			await trx('settings').update(updates).where({ id: user.id });
			return (await trx.select('id', 'username', 'token', 'avatar', 'email').from('users').where({ id: user.id }))[0];
		});
	}

	public async setPassword(token: string, newPassword: string): Promise<void> {
		const salt = randomBytes(16).toString('hex');
		const hashedPassword = createHash('sha256')
			.update(newPassword + salt)
			.digest('hex');

		await this._db('users').update({ password: hashedPassword, salt }).where({ token });
	}

	public async resetAvatar(token: string): Promise<AppUser> {
		const [user] = await this._db.select('username', 'id', 'token', 'email', 'avatar').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		const newDefaultAvatar = `https://ui-avatars.com/api?name=${encodeURIComponent(user.username)}&background=${this._generateRandomColor()}&length=1`;

		await this._db('users').update({ avatar: newDefaultAvatar }).where({ id: user.id });

		user.avatar = newDefaultAvatar;
		return user;
	}

	public async getMessages(channelId: number): Promise<Message[]> {
		return this._db<Message>('messages').where({ channelId });
	}

	public async createMessage(author: User, content: string, channelId: number): Promise<MessageDTO> {
		const newMessage: Omit<Message, 'id' | 'createdAt'> = {
			channelId,
			authorId: author.id,
			content
		};

		return this._db.transaction(async (trx) => {
			const [id] = await trx.insert(newMessage).into('messages');

			const msg = await (trx<Message>('messages').where({ id }).first() as Promise<Message>);
			const author = await trx.select('id', 'username', 'avatar').from('users').where({ id: msg.authorId }).first();
			return { ...msg, author };
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
			.innerJoin('channel_access', function () {
				this.on('channel_access.channelId', '=', 'channels.id').andOn('channel_access.userId', '=', db.raw('?', [user.id]));
			});
	}

	public async getFriends(id: number): Promise<Friend[]>;
	public async getFriends(userToken: string): Promise<Friend[]>;
	public async getFriends(userTokenOrId: string | number): Promise<Friend[]> {
		if (typeof userTokenOrId === 'string') {
			const userToken = userTokenOrId;

			const [user] = await this._db.select('id').from('users').where({ token: userToken });

			if (!user) {
				throw new BadRequestException('Invalid user token');
			}

			const db = this._db;

			const friendUsers = await this._db
				.select(
					'users.id',
					'users.username',
					'users.avatar',
					'users.status',
					'friend.channelId',
					this._db.raw('message_notifications.count as unread')
				)
				.from('users')
				.innerJoin('friend', function () {
					this.on('friend.sender', '=', db.raw('?', [user.id])).andOn('friend.recipient', '=', 'users.id');
				})
				.leftJoin('message_notifications', function () {
					this.on('message_notifications.user', '=', 'users.id').andOn('message_notifications.channelId', '=', 'friend.channelId');
				});

			return friendUsers
				.map((friend) => (friend.unread === null ? { ...friend, unread: 0 } : friend))
				.map((friend) => (friend.status === 'INVISIBLE' ? { ...friend, status: 'OFFLINE' } : friend));
		} else {
			const id = userTokenOrId;
			const db = this._db;

			const friendUsers = await this._db
				.select(
					'users.id',
					'users.username',
					'users.avatar',
					'users.status',
					'friend.channelId',
					this._db.raw('message_notifications.count as unread')
				)
				.from('users')
				.innerJoin('friend', function () {
					this.on('friend.sender', '=', db.raw('?', [id])).andOn('friend.recipient', '=', 'users.id');
				})
				.leftJoin('message_notifications', function () {
					this.on('message_notifications.user', '=', 'users.id').andOn('message_notifications.channelId', '=', 'friend.channelId');
				});

			return friendUsers
				.map((friend) => (friend.unread === null ? { ...friend, unread: 0 } : friend))
				.map((friend) => (friend.status === 'INVISIBLE' ? { ...friend, status: 'OFFLINE' } : friend));
		}
	}

	public async getFriendRequests(token: string): Promise<FriendRequestResponseDTO[]> {
		const [user] = await this._db.select('id').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		const requests = await this._db.select('fromId', 'requestedAt').from('friend_request').where({ toId: user.id });

		return Promise.all(
			requests.map(async ({ fromId, requestedAt }) => ({
				from: (await this._db.select('id', 'username', 'avatar').from('users').where({ id: fromId }))[0],
				timestamp: requestedAt
			}))
		);
	}

	public async makeFriendRequest(token: string, friendId: number): Promise<void>;
	public async makeFriendRequest(token: string, username: string): Promise<void>;
	public async makeFriendRequest(token: string, idOrUsername: number | string): Promise<void> {
		const [user] = await this._db.select('id', 'username').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		if (typeof idOrUsername === 'string') {
			const username = idOrUsername;

			if (user.username === username) {
				throw new BadRequestException('Requested friend is reqesting user');
			}

			const [friend] = await this._db.select('id').from('users').where({ username });

			if (!friend) {
				throw new BadRequestException('No user with that username exists.');
			}

			const requests = await this._db.select('*').from('friend_request').where({ fromId: user.id, toId: friend.id });

			if (requests.length > 0) {
				throw new BadRequestException('There already exists a friend request to the target user.');
			}

			return this._db.transaction(async (trx) => {
				await trx<{ fromId: number; toId: number }>('friend_request').insert({ fromId: user.id, toId: friend.id });
			});
		} else {
			const friendId = idOrUsername;

			if (user.id === friendId) {
				throw new BadRequestException('Requested friend is reqesting user');
			}

			const [friend] = await this._db.select('id').from('users').where({ id: friendId });

			if (!friend) {
				throw new BadRequestException('No user with that id exists.');
			}

			const requests = await this._db.select('*').from('friend_request').where({ fromId: user.id, toId: friendId });

			if (requests.length > 0) {
				throw new BadRequestException('There already exists a friend request to the target user.');
			}

			return this._db.transaction(async (trx) => {
				await trx<{ fromId: number; toId: number }>('friend_request').insert({ fromId: user.id, toId: friendId });
			});
		}
	}

	public async acceptFriendRequest(token: string, friendId: number): Promise<Friend> {
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
			const [newFriend] = await trx.select('id', 'username', 'avatar', 'status').from('users').where({ id: request.fromId });

			const [channelId] = await trx.insert({ name: `${newFriend.username}-${user.username}`, type: 'direct' }).into('channels');
			await trx.insert({ sender: newFriend.id, recipient: user.id, channelId }).into('friend');
			await trx.insert({ sender: user.id, recipient: newFriend.id, channelId }).into('friend');

			await trx.insert({ userId: user.id, channelId }).into('channel_access');
			await trx.insert({ userId: newFriend.id, channelId }).into('channel_access');

			await trx.delete().from('friend_request').where({ fromId: friendId, toId: user.id }).orWhere({ fromId: user.id, toId: friendId });
			await trx.delete().from('friend_notifications').where({ user: user.id, from: friendId, to: user.id });

			return { ...newFriend, channelId };
		});
	}

	public async rejectFriendRequest(token: string, rejectedId: number): Promise<void> {
		const [user] = await this._db.select('id', 'username').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		if (user.id === rejectedId) {
			throw new BadRequestException('Requested friend is reqesting user');
		}

		const [request] = await this._db.select('fromId', 'toId', 'requestedAt').from('friend_request').where({ fromId: rejectedId, toId: user.id });

		if (!request) {
			throw new BadRequestException('There does not exist an outstanding friend request from that user');
		}

		return this._db.transaction(async (trx) => {
			await trx.delete().from('friend_request').where({ fromId: rejectedId, toId: user.id });
			await trx.delete().from('friend_notifications').where({ user: user.id, from: rejectedId, to: user.id });
		});
	}

	public async getBestFriend(token: string): Promise<Friend> {
		const [user] = await this._db.select('id', 'username').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		const db = this._db;

		return (
			await this._db
				.select('users.id', 'username', 'avatar', 'status', 'friend.channelId')
				.from('users')
				.innerJoin('friend', function () {
					this.on('friend.sender', '=', db.raw('?', [user.id])).andOn('friend.recipient', '=', 'users.id');
				})
				.crossJoin('messages', () => {})
				.whereRaw('users.id = messages.authorId')
				.groupBy(['users.id', 'friend.channelId'])
				.orderBy(db.count('messages.id'), 'desc')
		)[0];
	}

	public async filterFriends(token: string, filterMethod: FilterMethod, query?: string): Promise<Friend[]> {
		const [user] = await this._db.select('id', 'username').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		const db = this._db;

		if (filterMethod === 'RECENTLY_MESSAGED') {
			return await this._db
				.select('users.id', 'username', 'avatar', 'status', 'friend.channelId')
				.from('users')
				.innerJoin('friend', function () {
					this.on('friend.sender', '=', db.raw('?', [user.id])).andOn('friend.recipient', '=', 'users.id');
				})
				.crossJoin('messages', () => {})
				.whereRaw('users.id = messages.authorId')
				.groupBy(['users.id', 'friend.channelId'])
				.orderBy(db.max('messages.createdAt'), 'desc');
		} else {
			if (query !== undefined) {
				return await this._db
					.select('users.id', 'username', 'avatar', 'status', 'friend.channelId')
					.from('users')
					.innerJoin('friend', function () {
						this.on('friend.sender', '=', db.raw('?', [user.id])).andOn('friend.recipient', '=', 'users.id');
					})
					.where(this._db.raw('lower(username)'), 'like', `${query.toLowerCase()}%`)
					.orderBy('users.username', filterMethod === 'USERNAME_ASC' ? 'asc' : 'desc');
			} else {
				return await this._db
					.select('users.id', 'username', 'avatar', 'status', 'friend.channelId')
					.from('users')
					.innerJoin('friend', function () {
						this.on('friend.sender', '=', db.raw('?', [user.id])).andOn('friend.recipient', '=', 'users.id');
					})
					.orderBy('users.username', filterMethod === 'USERNAME_ASC' ? 'asc' : 'desc');
			}
		}
	}

	public async block(token: string, blockedId: number): Promise<void>;
	public async block(token: string, username: string): Promise<void>;
	public async block(token: string, idOrUsername: number | string): Promise<void> {
		const [user] = await this._db.select('id', 'username').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		if (typeof idOrUsername === 'string') {
			const username = idOrUsername;

			if (user.username === username) {
				throw new BadRequestException('You cannot block yourself');
			}

			const [blockee] = await this._db.select('id').from('users').where({ username });

			if (!blockee) {
				throw new BadRequestException('No user with that username exists.');
			}

			const blocks = await this._db.select('*').from('blocked').where({ blocker: user.id, blocked: blockee.id });

			if (blocks.length > 0) {
				throw new BadRequestException('You are already blocking the target user.');
			}

			return this._db.transaction(async (trx) => {
				await trx<{ blocker: number; blocked: number }>('blocked').insert({ blocker: user.id, blocked: blockee.id });
			});
		} else {
			const blockedId = idOrUsername;

			if (user.id === blockedId) {
				throw new BadRequestException('You cannot block yourself');
			}

			const [friend] = await this._db.select('id').from('users').where({ id: blockedId });

			if (!friend) {
				throw new BadRequestException('No user with that id exists.');
			}

			const blocks = await this._db.select('*').from('blocked').where({ blocker: user.id, blocked: blockedId });

			if (blocks.length > 0) {
				throw new BadRequestException('You are already blocking the target user.');
			}

			return this._db.transaction(async (trx) => {
				await trx<{ blocker: number; blocked: number }>('blocked').insert({ blocker: user.id, blocked: blockedId });
			});
		}
	}

	public async unblock(token: string, blockedId: number): Promise<void>;
	public async unblock(token: string, username: string): Promise<void>;
	public async unblock(token: string, idOrUsername: number | string): Promise<void> {
		const [user] = await this._db.select('id', 'username').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		if (typeof idOrUsername === 'string') {
			const username = idOrUsername;

			if (user.username === username) {
				throw new BadRequestException('You cannot block yourself');
			}

			const [blockee] = await this._db.select('id').from('users').where({ username });

			if (!blockee) {
				throw new BadRequestException('No user with that username exists.');
			}

			const [block] = await this._db.select('*').from('blocked').where({ blocker: user.id, blocked: blockee.id });

			if (!block) {
				throw new BadRequestException('You are not blocking the target user.');
			}

			return this._db.transaction(async (trx) => {
				await trx.delete().from('blocked').where({ blocker: user.id, blocked: blockee.id });
			});
		} else {
			const blockedId = idOrUsername;

			if (user.id === blockedId) {
				throw new BadRequestException('You cannot block yourself');
			}

			const [friend] = await this._db.select('id').from('users').where({ id: blockedId });

			if (!friend) {
				throw new BadRequestException('No user with that id exists.');
			}

			const [block] = await this._db.select('*').from('blocked').where({ blocker: user.id, blocked: blockedId });

			if (!block) {
				throw new BadRequestException('You are not blocking the target user.');
			}

			return this._db.transaction(async (trx) => {
				await trx.delete().from('blocked').where({ blocker: user.id, blocked: blockedId });
			});
		}
	}

	public async makeFriendNotification(user: number, from: number, to: number): Promise<void> {
		return this._db.insert({ user, from, to }).into('friend_notifications');
	}

	public async makeMessageNotification(user: number, channelId: number): Promise<void> {
		const [notification] = await this._db.select('user', 'channelId', 'count').from('message_notifications').where({ user, channelId });

		if (!notification) {
			await this._db.insert({ user, channelId, count: 1 }).into('message_notifications');
		} else {
			await this._db('message_notifications')
				.update({ count: this._db.raw('count + 1') })
				.where({ user, channelId });
		}
	}

	public async getNotifications(token: string): Promise<(FriendNotificationDTO | MessageNotificationDTO)[]> {
		const [user] = await this._db.select('id').from('users').where({ token });

		const friendNotifications = await this._db.select('user', 'from', 'to').from('friend_notifications').where({ user: user.id });
		const friendNotifDTOs = (
			await Promise.all(
				friendNotifications.map<Promise<FriendNotificationDTO | null>>(async ({ user, from, to }) => {
					if (user === to) {
						return {
							type: 'INCOMING_REQUEST',
							from: (await this._db.select('id', 'username', 'avatar').from('users').where({ id: from }))[0]
						};
					} else if (user === from) {
						const db = this._db;
						return {
							type: 'NEW_FRIEND',
							to: (
								await this._db
									.select('id', 'username', 'avatar', 'status', 'channelId')
									.from('users')
									.innerJoin('friend', function () {
										this.on('users.id', '=', 'friend.sender').andOn('friend.recipient', '=', db.raw('?', to));
									})
									.where({ id: to })
							)[0]
						};
					} else {
						return null;
					}
				})
			)
		).filter((val) => val !== null) as FriendNotificationDTO[];

		const messageNotifications = await this._db
			.select('channels.id', 'channels.name', 'channels.type', 'count')
			.from('message_notifications')
			.innerJoin('channels', function () {
				this.on('message_notifications.channelId', '=', 'channels.id');
			})
			.where({ user: user.id });

		return [...friendNotifDTOs, ...messageNotifications.map(({ id, name, type, count }) => ({ channel: { id, name, type }, count }))];
	}

	public async clearFriendNotification(token: string, type: FriendNotificationType, id: number): Promise<void> {
		const [user] = await this._db.select('id').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		await this._db
			.delete()
			.from('friend_notifications')
			.where(type === 'INCOMING_REQUEST' ? { user: user.id, type, from: id } : { user: user.id, type, to: id });
	}

	public async clearMessageNotification(token: string, channelId: number): Promise<void> {
		const [user] = await this._db.select('id').from('users').where({ token });

		if (!user) {
			throw new BadRequestException('Invalid user token');
		}

		await this._db.delete().from('message_notifications').where({ user: user.id, channel: channelId });
	}

	private _generateRandomColor(): string {
		return new Array(3)
			.fill(null)
			.map(() => Math.round(Math.random() * 255))
			.map((val) => val.toString(16))
			.map((val) => (val.length < 2 ? '0' + val : val))
			.join('');
	}
}


import {
	BadRequestException,
	Body,
	Controller,
	Get,
	InternalServerErrorException,
	NotFoundException,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
	UploadedFile,
	UseInterceptors,
	ValidationPipe
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as sgMail from '@sendgrid/mail';
import { createHash, randomBytes } from 'crypto';
import { CDNService } from './cdn/cdn.service';
import { DBService } from './db/db.service';
import { GatewayService } from './gateway/gateway.service';
import { Channel } from './models/Channel.model';
import { FriendRequestDTO, FriendRequestResponseDTO } from './models/FriendRequest.dto';
import { CreateMessageDTO, MessageDTO } from './models/Message.dto';
import { ClearNotificationDTO, FriendNotificationDTO, MessageNotificationDTO } from './models/Notifications.dto';
import { CreateUserDTO, FilterMethod, LoginDTO } from './models/User.dto';
import { AppUser, Friend, NotificationsSetting, PublicUser, UserStatus } from './models/User.model';

interface SQLError {
	code: string;
	errno: number;
	sqlState: string;
	sqlMessage: string;
	sql: string;
}

@Controller()
export class AppController {
	private readonly _tokens: Map<string, string> = new Map();
	private readonly _timeouts: Map<string, NodeJS.Timeout> = new Map();

	constructor(private readonly dbService: DBService, private readonly gatewayService: GatewayService, private readonly cdnService: CDNService) {}

	@Post('/keepalive')
	public keepalive(): void {}

	@Get('/admin-panel')
	async adminPanel() {
		return `
			<html>
				<head>
					<title>Admin Panel</title>
					<style>
						* {
							margin: 0;
							padding: 0;
						}

						table {
							margin-top: 1em;
							margin-bottom: 2em;
							border-collapse: collapse;
						}

						td {
							border: 1px solid black;
							padding: 2px 4px;
						}
					</style>
				</head>
				<body>
					<h1>Users</h1>
					<table>
						<thead>
							<tr>
								<td>ID</td>
								<td>username</td>
								<td>email</td>
								<td>avatar</td>
								<td>status</td>
								<td>token</td>
							</tr>
						</thead>
						<tbody>
							${(await this.dbService.getUsers())
								.map(
									({ id, username, email, avatar, status, token }) => `
								<tr>
									<td>${id}</td>
									<td>${username}</td>
									<td>${email}</td>
									<td>${avatar}</td>
									<td>${status}</td>
									<td>${token}</td>
								</tr>`
								)
								.join('')}
						</tbody>
					</table>
					<h1>Notifications</h1>
					<table>
						<thead>
							<tr>
								<td>User ID</td>
								<td>Channel ID</td>
								<td>count</td>
								<td>from</td>
								<td>to</td>
							</tr>
						</thead>
						<tbody>
							${(await this.dbService.getAllNotifications())
								.map(
									({ user, channelId, count, from, to }: any) => `
								<tr>
									<td>${user}</td>
									<td>${channelId}</td>
									<td>${count}</td>
									<td>${from}</td>
									<td>${to}</td>
								</tr>`
								)
								.join('')}
						</tbody>
					</table>
					<span>
						<h1>WS Messages</h1>
						<button onclick="resetLogs()">Reset Log</button>
					</span>
					<table>
						<thead>
							<tr>
								<td>Event</td>
								<td>Message</td>
								<td>Timestamp</td>
							</tr>
						</thead>
						<tbody>
							${this.gatewayService
								.getMessageLog()
								.map(
									({ event, message, ...others }) => `
								<tr>
									<td>${event}</td>
									<td>${
										typeof message === 'string'
											? message
											: Object.entries(message)
													.map(([key, value]) => `${key}: ${value}`)
													.join(', ')
									}</td>
									${'timestamp' in others ? `<td>${others.timestamp.toLocaleString()}</td>` : ''}
								</tr>`
								)
								.join('')}
						</tbody>
					</table>
					<script>
						function resetLogs() {
							fetch('/reset-gateway-logs', { method: 'POST' }).then(() => {
								location.reload();
							});
						}
					</script>
				</body>
			</html>
		`;
	}

	@Post('/reset-gateway-logs')
	resetGatewayLogs(): void {
		this.gatewayService.clearLog();
	}

	@Get('/users')
	async getUsers(@Query('id') id?: number): Promise<PublicUser[] | PublicUser> {
		const users = await this.dbService.getPublicUsers(id);

		if (id !== undefined) {
			if (users.length === 0) {
				throw new NotFoundException('User not found!');
			}

			return users[0];
		} else {
			return users;
		}
	}

	@Get('/users/:id')
	async getUser(@Param('id') id?: number): Promise<PublicUser> {
		const users = await this.dbService.getPublicUsers(id);

		if (users.length === 0) {
			throw new NotFoundException('User not found!');
		}

		return users[0];
	}

	@Get('/me')
	async getMe(@Query('token') token: string): Promise<AppUser> {
		const user = await this.dbService.getUserByToken(token);

		if (!user) {
			throw new NotFoundException('User not found!');
		}

		return {
			id: user.id,
			username: user.username,
			token: user.token,
			avatar: user.avatar,
			email: user.email,
			status: user.status,
			settings: { notifications: user.notifications, lightMode: user.lightMode }
		};
	}

	@Patch('/me')
	async modifySettings(
		@Body('token') token: string,
		@Body('status') status: UserStatus,
		@Body('notifications') notifications: NotificationsSetting,
		@Body('lightMode') lightMode: string,
		@Body('email') email: string,
		@Body('username') username: string
	): Promise<AppUser> {
		if (email !== undefined) {
			await this.dbService.updateEmail(token, email);
		}
		if (username !== undefined) {
			await this.dbService.updateUsername(token, username);
		}

		const updatedUser = await this.dbService.updateUser(token, { status, notifications, lightMode: lightMode === 'true' });

		if (status !== undefined) {
			this.gatewayService.setStatus(updatedUser.id, updatedUser.status);
			(await this.dbService.getFriends(updatedUser.id)).forEach((friend) => {
				if (this.gatewayService.isOnline(friend.id)) {
					this.gatewayService.notify(
						{ type: 'STATUS_CHANGE', id: updatedUser.id, status: updatedUser.status === 'INVISIBLE' ? 'OFFLINE' : updatedUser.status },
						friend.id
					);
				}
			});
		}

		return updatedUser;
	}

	@Post('/signup')
	async createUser(@Body() user: CreateUserDTO): Promise<AppUser> {
		try {
			const { id, username, token, avatar, email, status } = await this.dbService.createUser(user);

			sgMail.send({
				to: email,
				from: 'chatterbox@null.net',
				subject: 'ChatterBox Registration',
				text: 'Thank you for signing up with ChatterBox!',
				html: '<span>Thank you for signing up with <strong>ChatterBox</strong>!</span>'
			});

			return { id, username, token, avatar, email, status, settings: { notifications: 'ALL', lightMode: false } };
		} catch (e: unknown) {
			const err = e as SQLError;

			if ('code' in err && err.code === 'ER_DUP_ENTRY') {
				if (err.sqlMessage.includes('username')) {
					throw new BadRequestException({ error: 'DUPLICATE_USERNAME', message: 'User with that username already exists.' });
				} else if (err.sqlMessage.includes('email')) {
					throw new BadRequestException({ error: 'DUPLICATE_EMAIL', message: 'There is already a user associated to that email.' });
				} else {
					console.log(err);
					throw new InternalServerErrorException('Something probably went wrong with the SQL');
				}
			} else {
				console.log(err);
				throw new InternalServerErrorException('Something probably went wrong (but not the SQL)');
			}
		}
	}

	@Post('/login')
	async login(@Body() loginInfo: LoginDTO): Promise<AppUser> {
		const user = await this.dbService.getUserByEmail(loginInfo.email);

		if (!user) {
			throw new BadRequestException('Incorrect username or password!');
		}

		const hashedPassword = createHash('sha256')
			.update(loginInfo.password + user.salt)
			.digest('hex');

		if (user.password !== hashedPassword) {
			throw new BadRequestException('Incorrect username or password!');
		}

		return {
			id: user.id,
			username: user.username,
			token: user.token,
			avatar: user.avatar,
			email: user.email,
			status: user.status,
			settings: { notifications: user.notifications, lightMode: !!user.lightMode }
		};
	}

	@Post('/reset-password')
	async resetPassword(@Body('token') token: string, @Body('email') email: string): Promise<void> {
		if (token) {
			const user = await this.dbService.getUserByToken(token);

			if (!user) {
				throw new BadRequestException('Invalid token!');
			}

			const nonce = randomBytes(16).toString('hex');

			await sgMail.send({
				to: user.email,
				from: 'chatterbox@null.net',
				subject: 'ChatterBox Password Reset',
				text: `We received a request to reset your password. To do so, please visit ${process.env.PASS_RESET_URL}?nonce=${nonce}. If this was not you, you can safely ignore this email. This link expires in 30 minutes.`,
				html: `<span>We received a request to <strong>reset your password</strong>. To do so, please visit <a href="${process.env.PASS_RESET_URL}?nonce=${nonce}" target="__blank" rel="noreferrer noopener">this URL</a>. If this was <strong>not</strong> you, <i>you can safely ignore this email</i>. <strong>This link expires in 30 minutes</strong>.</span>`
			});

			this._tokens.set(nonce, user.token);
			this._timeouts.set(
				nonce,
				setTimeout(() => {
					this._tokens.delete(nonce);
					this._timeouts.delete(nonce);
				}, 30 * 60 * 1000)
			);
		} else if (email) {
			const user = await this.dbService.getUserByEmail(email);

			if (!user) {
				throw new BadRequestException('Invalid token!');
			}

			const nonce = randomBytes(16).toString('hex');

			await sgMail.send({
				to: email,
				from: 'chatterbox@null.net',
				subject: 'ChatterBox Password Reset',
				text: `We received a request to reset your password. To do so, please visit ${process.env.PASS_RESET_URL}?nonce=${nonce}. If this was not you, you can safely ignore this email. This link expires in 30 minutes.`,
				html: `<span>We received a request to <strong>reset your password</strong>. To do so, please visit <a href="${process.env.PASS_RESET_URL}?nonce=${nonce}" target="__blank" rel="noreferrer noopener">this URL</a>. If this was <strong>not</strong> you, <i>you can safely ignore this email</i>. <strong>This link expires in 30 minutes</strong>.</span>`
			});

			this._tokens.set(nonce, user.token);
			this._timeouts.set(
				nonce,
				setTimeout(() => {
					this._tokens.delete(nonce);
					this._timeouts.delete(nonce);
				}, 30 * 60 * 1000)
			);
		} else {
			throw new BadRequestException('Must have either token or email!');
		}
	}

	@Post('/set-password')
	async setPassword(@Body('nonce') nonce: string, @Body('password') newPassword: string): Promise<void> {
		if (!nonce) {
			throw new BadRequestException('Missing nonce for set password.');
		}

		if (!this._timeouts.has(nonce)) {
			throw new BadRequestException('Invalid nonce (time could have expired).');
		}

		clearTimeout(this._timeouts.get(nonce));
		const token = this._tokens.get(nonce)!;

		await this.dbService.setPassword(token, newPassword);
	}

	@Get('/valid-nonce')
	isValidNonce(@Query('nonce') nonce: string): void {
		if (!this._tokens.has(nonce)) {
			throw new BadRequestException('Invalid nonce (time could have expired)');
		}
	}

	@Post('/create-message')
	async createMessage(@Body() messageInfo: CreateMessageDTO): Promise<MessageDTO> {
		const author = await this.dbService.getUserByToken(messageInfo.token);

		if (!author) {
			throw new BadRequestException('Invalid token!');
		}

		const newMessage = await this.dbService.createMessage(author, messageInfo.content, messageInfo.channelId);

		const users = (await this.dbService.getRecipients(messageInfo.channelId)).filter((user) => user.id !== author.id);
		users.forEach(async (user) => {
			const fullUser = (await this.dbService.getUserById(user.id))!;

			if (fullUser.notifications === 'ALL' || fullUser.notifications === 'MESSAGES') {
				this.dbService.makeMessageNotification(user.id, messageInfo.channelId);

				if (this.gatewayService.isOnline(user.id)) {
					this.gatewayService.notify({ type: 'MESSAGE', message: newMessage }, user.id);
				}
			}
		});

		return newMessage;
	}

	@Patch('/set-avatar')
	@UseInterceptors(FileInterceptor('file'))
	async setAvatar(@UploadedFile() file: Express.Multer.File, @Body('token') token: string): Promise<string> {
		const user = await this.dbService.getUserByToken(token);

		if (!user) {
			throw new BadRequestException('Invalid token!');
		}

		const path = this.cdnService.saveAvatar(file);
		const avatarURL =
			process.env.NODE_ENV === 'development' ? `http://localhost:8888/cdn/avatar/${path}` : `https://${process.env.DOMAIN}/cdn/avatar/${path}`;

		const success = await this.dbService.setAvatar(user, avatarURL);

		if (success) {
			return avatarURL;
		} else {
			throw new InternalServerErrorException('Something went wrong...');
		}
	}

	@Post('/reset-avatar')
	async resetAvatar(@Body('token') token: string): Promise<AppUser> {
		return this.dbService.resetAvatar(token);
	}

	@Get('/channels')
	async getChannels(@Query('token') userToken: string): Promise<Channel[]> {
		return this.dbService.getPublicChannels(userToken);
	}

	@Get('/messages')
	async getMessages(@Query('token') userToken: string, @Query('channelId', ParseIntPipe) channelId: number): Promise<MessageDTO[]> {
		const channels = await this.dbService.getChannels(userToken);

		if (!channels.find((channel) => channel.id === channelId)) {
			throw new BadRequestException('User does not have access to that channel.');
		}

		return this.dbService.getMessages(channelId);
	}

	@Get('/friends')
	async getFriend(@Query('token') userToken: string, @Query('filter') filterMethod: FilterMethod, @Query('query') query: string): Promise<Friend[]> {
		if (filterMethod !== undefined) {
			return this.dbService.filterFriends(userToken, filterMethod, query);
		} else {
			return this.dbService.getFriends(userToken);
		}
	}

	@Post('/request-friend')
	async requestFriend(@Body(new ValidationPipe({ skipUndefinedProperties: true })) { token, friendId, username }: FriendRequestDTO): Promise<void> {
		if (friendId !== undefined) {
			const friend = await this.dbService.getUserById(friendId),
				user = await this.dbService.getUserByToken(token);

			if (friend && user) {
				await this.dbService.makeFriendRequest(token, friendId);

				if (friend.notifications === 'ALL' || friend.notifications === 'FRIEND_REQ') {
					await this.dbService.makeFriendNotification(friendId, user.id, friendId);
				}

				if (this.gatewayService.isOnline(friend.id)) {
					const { id, avatar, username } = user;
					this.gatewayService.notify({ type: 'FRIEND_REQ', from: { id, avatar, username } }, friend.id);
				}
			}
		} else if (username) {
			const friend = await this.dbService.getUserByName(username),
				user = await this.dbService.getUserByToken(token);

			if (friend && user) {
				await this.dbService.makeFriendRequest(token, username);

				if (friend.notifications === 'ALL' || friend.notifications === 'FRIEND_REQ') {
					await this.dbService.makeFriendNotification(friend.id, user.id, friend.id);
				}

				if (this.gatewayService.isOnline(friend.id)) {
					const { id, avatar, username } = user;
					this.gatewayService.notify({ type: 'FRIEND_REQ', from: { id, avatar, username } }, friend.id);
				}
			}
		} else {
			throw new BadRequestException('Needs either friend id or username to request friendship.');
		}
	}

	@Post('/accept-request')
	async accept(@Body('token') userToken: string, @Body('id') friendId: number): Promise<Friend> {
		const newFriend = await this.dbService.acceptFriendRequest(userToken, friendId),
			friendUser = (await this.dbService.getUserById(newFriend.id))!,
			user = (await this.dbService.getUserByToken(userToken))!;

		if (this.gatewayService.isOnline(newFriend.id) && (friendUser.notifications === 'ALL' || friendUser.notifications === 'FRIEND_REQ')) {
			const userAsFriend = (await this.dbService.getFriends(newFriend.id)).filter((friend) => friend.id === user.id)[0];
			this.gatewayService.notify({ type: 'NEW_FRIEND', friend: userAsFriend }, newFriend.id);
		} else if (friendUser.notifications === 'ALL' || friendUser.notifications === 'FRIEND_REQ') {
			this.dbService.makeFriendNotification(newFriend.id, newFriend.id, user.id);
		}

		return newFriend;
	}

	@Post('/reject-request')
	async reject(@Body('token') userToken: string, @Body('id') rejectedId: number): Promise<void> {
		return this.dbService.rejectFriendRequest(userToken, rejectedId);
	}

	@Get('/friend-requests')
	async getFriendRequest(@Query('token') userToken: string): Promise<FriendRequestResponseDTO[]> {
		return this.dbService.getFriendRequests(userToken);
	}

	@Get('/best-friend')
	async getBestFriend(@Query('token') userToken: string): Promise<PublicUser & { channelId: number }> {
		return this.dbService.getBestFriend(userToken);
	}

	@Get('/blocked')
	async getBlocked(@Query('token') token: string): Promise<PublicUser> {
		return this.dbService.getBlocked(token);
	}

	@Post('/block')
	async blockUser(@Body('token') token: string, @Body('id', ParseIntPipe) blockedId: number, @Body('username') username: string): Promise<void> {
		if (blockedId !== undefined) {
			await this.dbService.block(token, blockedId);
		} else if (username) {
			await this.dbService.block(token, username);
		} else {
			throw new BadRequestException('Needs either friend id or username to block a user.');
		}
	}

	@Post('/unblock')
	async unblockUser(@Body('token') token: string, @Body('id', ParseIntPipe) blockedId: number, @Body('username') username: string): Promise<void> {
		if (blockedId !== undefined) {
			await this.dbService.unblock(token, blockedId);
		} else if (username) {
			await this.dbService.unblock(token, username);
		} else {
			throw new BadRequestException('Needs either friend id or username to block a user.');
		}
	}

	@Get('/notifications')
	async getNotifications(@Query('token') userToken: string): Promise<(FriendNotificationDTO | MessageNotificationDTO)[]> {
		return this.dbService.getNotifications(userToken);
	}

	@Get('/unreads')
	async getNumUnreads(@Query('token') token: string): Promise<number> {
		return (await this.dbService.getNotifications(token)).reduce(
			(total, notif) => ('count' in notif && notif.channel!.type !== 'public' ? total + notif.count : total),
			0
		);
	}

	@Post('/clear-notification')
	async clearNotification(@Body(new ValidationPipe({ skipUndefinedProperties: true })) { token, channel, from, to }: ClearNotificationDTO): Promise<void> {
		if (channel !== undefined) {
			return this.dbService.clearMessageNotification(token, channel);
		} else if (from !== undefined) {
			return this.dbService.clearFriendNotification(token, 'INCOMING_REQUEST', from);
		} else if (to !== undefined) {
			return this.dbService.clearFriendNotification(token, 'NEW_FRIEND', to);
		} else {
			throw new BadRequestException(
				'Needs one of: the channel to clear message notifications from, the id of the user who sent a friend request, or the id of the new friend'
			);
		}
	}
}


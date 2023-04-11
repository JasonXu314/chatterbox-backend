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
	UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as sgMail from '@sendgrid/mail';
import { createHash, randomBytes } from 'crypto';
import { CDNService } from './cdn/cdn.service';
import { DBService } from './db/db.service';
import { GatewayService } from './gateway/gateway.service';
import { Channel } from './models/Channel.model';
import { FriendRequestResponseDTO } from './models/FriendRequest.dto';
import { CreateMessageDTO } from './models/Message.dto';
import { Message } from './models/Message.model';
import { CreateUserDTO, LoginDTO } from './models/User.dto';
import { AppUser, Friend, PublicUser } from './models/User.model';

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
							</tr>
						</thead>
						<tbody>
							${(await this.dbService.getUsers())
								.map(
									({ id, username, email, avatar, status }) => `
								<tr>
									<td>${id}</td>
									<td>${username}</td>
									<td>${email}</td>
									<td>${avatar}</td>
									<td>${status}</td>
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
								<td>event</td>
								<td>message</td>
							</tr>
						</thead>
						<tbody>
							${this.gatewayService
								.getMessageLog()
								.map(
									({ event, message }) => `
								<tr>
									<td>${event}</td>
									<td>${
										typeof message === 'string'
											? message
											: Object.entries(message)
													.map(([key, value]) => `${key}: ${value}`)
													.join(', ')
									}</td>
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

		return { id: user.id, username: user.username, token: user.token, avatar: user.avatar, email: user.email };
	}

	@Post('/signup')
	async createUser(@Body() user: CreateUserDTO): Promise<AppUser> {
		try {
			const { id, username, token, avatar, email } = await this.dbService.createUser(user);

			sgMail.send({
				to: email,
				from: 'chatterbox@null.net',
				subject: 'ChatterBox Registration',
				text: 'Thank you for signing up with ChatterBox!',
				html: '<span>Thank you for signing up with <strong>ChatterBox</strong>!</span>'
			});

			return { id, username, token, avatar, email };
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

		return { id: user.id, username: user.username, token: user.token, avatar: user.avatar, email: user.email };
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
	async createMessage(@Body() messageInfo: CreateMessageDTO): Promise<Message> {
		const author = await this.dbService.getUserByToken(messageInfo.token);

		if (!author) {
			throw new BadRequestException('Invalid token!');
		}

		const newMessage = await this.dbService.createMessage(author, messageInfo.content, messageInfo.channelId);

		this.gatewayService.broadcast({ type: 'MESSAGE', message: newMessage });

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
		return this.dbService.getChannels(userToken);
	}

	@Get('/messages')
	async getMessages(@Query('token') userToken: string, @Query('channelId', ParseIntPipe) channelId: number): Promise<Message[]> {
		const channels = await this.dbService.getChannels(userToken);

		if (!channels.find((channel) => channel.id === channelId)) {
			throw new BadRequestException('User does not have access to that channel.');
		}

		return this.dbService.getMessages(channelId);
	}

	@Get('/friends')
	async getFriend(@Query('token') userToken: string): Promise<Friend[]> {
		return this.dbService.getFriends(userToken);
	}

	@Post('/request-friend')
	async requestFriend(@Body('token') userToken: string, @Body('id') friendId: number, @Body('username') username: string): Promise<void> {
		if (friendId) {
			return this.dbService.makeFriendRequest(userToken, friendId);
		} else if (username) {
			return this.dbService.makeFriendRequest(userToken, username);
		} else {
			throw new BadRequestException('Needs either friend id or username to request friendship.');
		}
	}

	@Post('/accept-request')
	async accept(@Body('token') userToken: string, @Body('id') friendId: number): Promise<PublicUser & { channelId: number }> {
		return this.dbService.acceptFriendRequest(userToken, friendId);
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
}


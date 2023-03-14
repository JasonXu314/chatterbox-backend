import {
	BadRequestException,
	Body,
	Controller,
	Get,
	InternalServerErrorException,
	NotFoundException,
	Param,
	Patch,
	Post,
	Query,
	UploadedFile,
	UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as sgMail from '@sendgrid/mail';
import { createHash } from 'crypto';
import { CDNService } from './cdn/cdn.service';
import { DBService } from './db/db.service';
import { GatewayService } from './gateway/gateway.service';
import { Channel } from './models/Channel.model';
import { CreateMessageDTO } from './models/Message.dto';
import { Message } from './models/Message.model';
import { CreateUserDTO, LoginDTO } from './models/User.dto';
import { AppUser, PublicUser } from './models/User.model';

interface SQLError {
	code: string;
	errno: number;
	sqlState: string;
	sqlMessage: string;
	sql: string;
}

@Controller({ host: process.env.DOMAIN })
export class AppController {
	constructor(private readonly dbService: DBService, private readonly gatewayService: GatewayService, private readonly cdnService: CDNService) {}

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

		return { id: user.id, username: user.username, token: user.token, avatar: user.avatar };
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

			return { id, username, token, avatar };
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

		return { id: user.id, username: user.username, token: user.token, avatar: user.avatar };
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
			process.env.NODE_ENV === 'development' ? `http://cdn.localhost:8888/avatar/${path}` : `https://cdn.${process.env.DOMAIN}/avatar/${path}`;

		const success = await this.dbService.setAvatar(user, avatarURL);

		if (success) {
			return avatarURL;
		} else {
			throw new InternalServerErrorException('Something went wrong...');
		}
	}

	@Get('/channels')
	async getChannels(@Query('token') userToken: string): Promise<Channel[]> {
		return this.dbService.getChannels(userToken);
	}

	@Get('/friends')
	async getFriend(@Query('token') userToken: string): Promise<(PublicUser & { channelId: number })[]> {
		return this.dbService.getFriends(userToken);
	}

	@Post('/request-friend')
	async requestFriend(@Body('token') userToken: string, @Body('id') friendId: number): Promise<void> {
		return this.dbService.makeFriendRequest(userToken, friendId);
	}

	@Post('/accept-request')
	async accept(@Body('token') userToken: string, @Body('id') friendId: number): Promise<PublicUser & { channelId: number }> {
		return this.dbService.acceptFriendRequest(userToken, friendId);
	}
}


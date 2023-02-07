import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { createHash } from 'crypto';
import { DBService } from './db/db.service';
import { GatewayService } from './gateway/gateway.service';
import { CreateMessageDTO } from './models/Message.dto';
import { Message } from './models/Message.model';
import { CreateUserDTO, LoginDTO, LoginResultDTO } from './models/User.dto';
import { AppUser, PublicUser } from './models/User.model';

@Controller()
export class AppController {
	constructor(private readonly dbService: DBService, private readonly gatewayService: GatewayService) {}

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

	@Post('/signup')
	async createUser(@Body() user: CreateUserDTO): Promise<AppUser> {
		const { id, username, token } = await this.dbService.createUser(user);

		return { id, username, token };
	}

	@Post('/login')
	async login(@Body() loginInfo: LoginDTO): Promise<LoginResultDTO> {
		const user = await this.dbService.getUserByName(loginInfo.username);

		if (!user) {
			throw new BadRequestException('Incorrect username or password!');
		}

		const hashedPassword = createHash('sha256')
			.update(loginInfo.password + user.salt)
			.digest('hex');

		if (user.password !== hashedPassword) {
			throw new BadRequestException('Incorrect username or password!');
		}

		return { user: { id: user.id, username: user.username, token: user.token }, wsUUID: this.gatewayService.allocateUUID(user) };
	}

	@Post('/create-message')
	async createMessagE(@Body() messageInfo: CreateMessageDTO): Promise<Message> {
		const author = await this.dbService.getUserByToken(messageInfo.token);

		if (!author) {
			throw new BadRequestException('Invalid token!');
		}

		return this.dbService.createMessage(author, messageInfo.content, messageInfo.channelId);
	}
}


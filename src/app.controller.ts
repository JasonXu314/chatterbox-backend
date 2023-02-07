import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { createHash } from 'crypto';
import { DBService } from './db/db.service';
import { GatewayService } from './gateway/gateway.service';
import { CreateUserDTO, LoginDTO } from './users/User.dto';
import { AppUser } from './users/User.model';

@Controller()
export class AppController {
	constructor(private readonly dbService: DBService, private readonly gatewayService: GatewayService) {}

	@Get('/users')
	async getUsers(@Query('id') id?: number): Promise<AppUser[] | AppUser> {
		const users = await this.dbService.getAppUsers(id);

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
	async getUser(@Param('id') id?: number): Promise<AppUser> {
		const users = await this.dbService.getAppUsers(id);

		if (users.length === 0) {
			throw new NotFoundException('User not found!');
		}

		return users[0];
	}

	@Post('/signup')
	async createUser(@Body() user: CreateUserDTO): Promise<AppUser> {
		const newUser = await this.dbService.createUser(user);

		return { id: newUser.id, username: newUser.username };
	}

	@Post('/login')
	async login(@Body() loginInfo: LoginDTO): Promise<{ user: AppUser; wsUUID: string }> {
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

		return { user: { id: user.id, username: user.username }, wsUUID: this.gatewayService.allocateUUID(user) };
	}
}


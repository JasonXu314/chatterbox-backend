import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { createHash } from 'crypto';
import { DBService } from './db.service';
import { CreateUserDTO, LoginDTO } from './users/User.dto';
import { AppUser } from './users/User.model';

@Controller()
export class AppController {
	constructor(private readonly dbService: DBService) {}

	@Get('/users')
	async getUsers(): Promise<AppUser[]> {
		const users = await this.dbService.getUsers();

		return users.map(({ id, username }) => ({ id, username }));
	}

	@Post('/signup')
	async createUser(@Body() user: CreateUserDTO): Promise<AppUser> {
		const newUser = await this.dbService.createUser(user);

		return { id: newUser.id, username: newUser.username };
	}

	@Post('/login')
	async login(@Body() loginInfo: LoginDTO): Promise<AppUser> {
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

		return { id: user.id, username: user.username };
	}
}


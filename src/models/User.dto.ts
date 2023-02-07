import { AppUser } from './User.model';

export class CreateUserDTO {
	username: string;
	password: string;
}

export class LoginDTO {
	username: string;
	password: string;
}

export class LoginResultDTO {
	user: AppUser;
	wsUUID: string;
}

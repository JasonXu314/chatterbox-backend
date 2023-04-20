export type FilterMethod = 'RECENTLY_MESSAGED' | 'USERNAME_ASC' | 'USERNAME_DESC';

export class CreateUserDTO {
	email: string = '';
	username: string = '';
	password: string = '';
}

export class LoginDTO {
	email: string = '';
	password: string = '';
}


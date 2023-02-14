export class User {
	id: number;
	username: string;
	password: string;
	salt: string;
	token: string;
	email: string;
}

export type AppUser = Pick<User, 'id' | 'username' | 'token'>;
export type PublicUser = Pick<User, 'id' | 'username'>;


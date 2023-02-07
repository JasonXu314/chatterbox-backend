export class User {
	id: number;
	username: string;
	password: string;
	salt: string;
	token: string;
}

export type AppUser = Omit<User, 'password' | 'salt'>;
export type PublicUser = Omit<User, 'password' | 'salt' | 'token'>;


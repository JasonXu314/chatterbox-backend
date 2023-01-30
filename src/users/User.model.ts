export class User {
	id: number;
	username: string;
	password: string;
	salt: string;
}

export type AppUser = Omit<User, 'password' | 'salt'>;

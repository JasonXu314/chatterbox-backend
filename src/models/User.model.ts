export type UserStatus = 'ONLINE' | 'OFFLINE' | 'IDLE' | 'DO_NOT_DISTURB';

export class User {
	id: number;
	username: string;
	password: string;
	salt: string;
	token: string;
	email: string;
	avatar: string;
	status: UserStatus;
}

export type AppUser = Pick<User, 'id' | 'username' | 'token' | 'avatar' | 'email'>;
export type PublicUser = Pick<User, 'id' | 'username' | 'avatar'>;
export type Friend = PublicUser & { status: UserStatus; channelId: number };


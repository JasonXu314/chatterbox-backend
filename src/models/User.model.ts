export type UserStatus = 'ONLINE' | 'OFFLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'INVISIBLE';
export type NotificationsSetting = 'ALL' | 'MESSAGES' | 'FRIEND_REQ' | 'NONE';

export class User {
	id: number = -1;
	username: string = '';
	password: string = '';
	salt: string = '';
	token: string = '';
	email: string = '';
	avatar: string = '';
	status: UserStatus = 'OFFLINE';
}

export type Settings = { notifications: NotificationsSetting; lightMode: boolean };

export type AppUser = Pick<User, 'id' | 'username' | 'token' | 'avatar' | 'email'> & { status: UserStatus; settings: Settings };
export type PublicUser = Pick<User, 'id' | 'username' | 'avatar'>;
export type Friend = PublicUser & { status: UserStatus; channelId: number; unread: number };


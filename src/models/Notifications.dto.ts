import { IsDefined, IsInt, IsString } from 'class-validator';
import { Channel } from './Channel.model';
import { PublicUser } from './User.model';
import { forceInit } from './utils';

export type FriendNotificationType = 'INCOMING_REQUEST' | 'NEW_FRIEND';

export class FriendNotificationDTO {
	type: FriendNotificationType = 'INCOMING_REQUEST';
	from?: PublicUser;
	to?: PublicUser;
}

export class MessageNotificationDTO {
	channel: Channel | null = null;
	count: number = -1;
}

export class ClearNotificationDTO {
	@IsDefined()
	@IsString()
	token: string = forceInit();

	@IsInt()
	channel: number = forceInit();

	@IsInt()
	from: number = forceInit();

	@IsInt()
	to: number = forceInit();
}


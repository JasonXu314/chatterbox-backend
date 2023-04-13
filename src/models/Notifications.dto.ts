import { Channel } from './Channel.model';
import { PublicUser } from './User.model';

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


import { Channel } from './Channel.model';
import { PublicUser } from './User.model';

export class CreateMessageDTO {
	channelId: number = -1;
	content: string = '';
	token: string = '';
}

export class MessageDTO {
	author: PublicUser = { id: -1, avatar: '', username: '' };
	id: number = -1;
	channel: Channel = { id: -1, name: '', type: 'public' };
	content: string = '';
	createdAt: Date = new Date();
}


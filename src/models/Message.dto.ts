import { PublicUser } from './User.model';

export class CreateMessageDTO {
	channelId: number = -1;
	content: string = '';
	token: string = '';
}

export class MessageDTO {
	author: PublicUser = { id: -1, avatar: '', username: '' };
	id: number = -1;
	channelId: number = -1;
	content: string = '';
	createdAt: Date = new Date();
}

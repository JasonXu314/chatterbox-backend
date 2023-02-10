import { Message } from 'src/models/Message.model';

export type InboundWSMessage = WSClaimMessage | WSSendMessage;
export type OutboundWSMessage = WSMessage;

export type WSClaimMessage = {
	type: 'CONNECT';
	token: string;
};

export type WSSendMessage = {
	type: 'SEND';
	message: string;
	channelId: number;
};

export type WSMessage = {
	type: 'MESSAGE';
	message: Message;
};


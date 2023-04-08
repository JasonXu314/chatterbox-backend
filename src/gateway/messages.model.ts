import { Message } from 'src/models/Message.model';
import { UserStatus } from 'src/models/User.model';

export type InboundWSMessage = WSClaimMessage | WSSendMessage;
export type OutboundWSMessage = WSMessage | WSStatusChangeMessage;

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

export type WSStatusChangeMessage = {
	type: 'STATUS_CHANGE';
	id: number;
	status: UserStatus;
};


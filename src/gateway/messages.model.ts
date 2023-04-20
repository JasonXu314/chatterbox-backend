import { MessageDTO } from 'src/models/Message.dto';
import { Friend, PublicUser, UserStatus } from 'src/models/User.model';

export type InboundWSMessage = WSClaimMessage | WSSendMessage;
export type OutboundWSMessage = WSMessage | WSStatusChangeMessage | FriendReqMessage | NewFriendMessage;

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
	message: MessageDTO;
};

export type WSStatusChangeMessage = {
	type: 'STATUS_CHANGE';
	id: number;
	status: UserStatus;
};

export type FriendReqMessage = {
	type: 'FRIEND_REQ';
	from: PublicUser;
};

export type NewFriendMessage = {
	type: 'NEW_FRIEND';
	friend: Friend;
};


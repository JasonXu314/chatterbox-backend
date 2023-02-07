export type WSMessage = WSClaimMessage | WSSendMessage;

export type WSClaimMessage = {
	type: 'CLAIM';
	uuid: string;
};

export type WSSendMessage = {
	type: 'SEND';
	message: string;
	channelId: number;
};


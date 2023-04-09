import { Injectable, Logger } from '@nestjs/common';
import { DBService } from 'src/db/db.service';
import { User, UserStatus } from 'src/models/User.model';
import { WebSocket } from 'ws';
import { InboundWSMessage, OutboundWSMessage, WSStatusChangeMessage } from './messages.model';

@Injectable()
export class GatewayService {
	private _logger: Logger;
	private _socketToUser: Map<WebSocket, number> = new Map();
	private _userToSocket: Map<number, WebSocket> = new Map();
	private _statuses: Map<number, UserStatus> = new Map();
	private _messageLog: (InboundWSMessage | OutboundWSMessage)[] = [];

	constructor(private readonly dbService: DBService) {
		this._logger = new Logger('GatewayService');
	}

	public addSocket(socket: WebSocket, user: User): void {
		this._socketToUser.set(socket, user.id);
		this._userToSocket.set(user.id, socket);
		this._statuses.set(user.id, 'ONLINE');
		this.dbService.setStatus(user.id, 'ONLINE');

		const msg: WSStatusChangeMessage = {
			type: 'STATUS_CHANGE',
			id: user.id,
			status: 'ONLINE'
		};

		this.logMessage(msg);

		this.dbService.getFriends(user.token).then((friends) => {
			friends.forEach((friend) => {
				if (this._userToSocket.has(friend.id)) {
					this._userToSocket.get(friend.id).send(JSON.stringify(msg));
				}
			});
		});
	}

	public async getUser(socket: WebSocket): Promise<User | null> {
		const userId = this._socketToUser.get(socket);

		if (!userId) {
			return null;
		}

		return this.dbService.getUserById(userId);
	}

	public closeSocket(socket: WebSocket): void {
		const userId = this._socketToUser.get(socket);

		if (userId) {
			this._socketToUser.delete(socket);
			this._userToSocket.delete(userId);

			const msg: WSStatusChangeMessage = {
				type: 'STATUS_CHANGE',
				id: userId,
				status: 'OFFLINE'
			};

			this.logMessage(msg);

			this.dbService.getFriends(userId).then((friends) => {
				friends.forEach((friend) => {
					if (this._userToSocket.has(friend.id)) {
						this._userToSocket.get(friend.id).send(JSON.stringify(msg));
					}
				});
			});
		}
	}

	public broadcast(message: OutboundWSMessage): void {
		this._userToSocket.forEach((socket) => {
			socket.send(JSON.stringify(message));
		});
	}

	public logMessage(message: InboundWSMessage | OutboundWSMessage): void {
		this._messageLog.push(message);
	}

	public getMessageLog(): (InboundWSMessage | OutboundWSMessage)[] {
		return this._messageLog;
	}

	public clearLog(): void {
		this._messageLog = [];
	}
}


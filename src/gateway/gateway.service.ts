import { Injectable, Logger } from '@nestjs/common';
import { DBService } from 'src/db/db.service';
import { User, UserStatus } from 'src/models/User.model';
import { WebSocket } from 'ws';
import { InboundWSMessage, OutboundWSMessage, WSStatusChangeMessage } from './messages.model';

export type LogEntry =
	| { event: 'send'; message: OutboundWSMessage }
	| { event: 'recv'; message: InboundWSMessage; timestamp: Date }
	| { event: 'close'; message: string; timestamp: Date }
	| { event: 'kill'; message: string; timestamp: Date }
	| { event: 'error'; message: string }
	| { event: 'connected'; message: string }
	| { event: 'opened'; message: string };

@Injectable()
export class GatewayService {
	private _logger: Logger;
	private _socketToUser: Map<WebSocket, number> = new Map();
	private _userToSocket: Map<number, WebSocket> = new Map();
	private _statuses: Map<number, UserStatus> = new Map();
	private _eventLog: LogEntry[] = [];

	constructor(private readonly dbService: DBService) {
		this._logger = new Logger('GatewayService');
	}

	public addSocket(socket: WebSocket, user: User): void {
		this._socketToUser.set(socket, user.id);
		this._userToSocket.set(user.id, socket);

		if (user.status === 'OFFLINE') {
			this._statuses.set(user.id, 'ONLINE');
			this.dbService.setStatus(user.id, 'ONLINE');

			const msg: WSStatusChangeMessage = {
				type: 'STATUS_CHANGE',
				id: user.id,
				status: 'ONLINE'
			};

			this.logEvent({ event: 'send', message: msg });

			this.dbService.getFriends(user.token).then((friends) => {
				friends.forEach((friend) => {
					if (this._userToSocket.has(friend.id)) {
						this._userToSocket.get(friend.id)!.send(JSON.stringify(msg));
					}
				});
			});
		} else {
			this._statuses.set(user.id, user.status);
		}
	}

	public async getUser(socket: WebSocket): Promise<User | null> {
		const userId = this._socketToUser.get(socket);

		if (userId === undefined) {
			return null;
		}

		return this.dbService.getUserById(userId);
	}

	public closeSocket(socket: WebSocket): void {
		const userId = this._socketToUser.get(socket);

		if (userId !== undefined) {
			this._socketToUser.delete(socket);
			this._userToSocket.delete(userId);

			if (this._statuses.get(userId) === 'ONLINE') {
				this._statuses.set(userId, 'OFFLINE');
				this.dbService.setStatus(userId, 'OFFLINE');

				const msg: WSStatusChangeMessage = {
					type: 'STATUS_CHANGE',
					id: userId,
					status: 'OFFLINE'
				};

				this.logEvent({ event: 'send', message: msg });

				this.dbService.getFriends(userId).then((friends) => {
					friends.forEach((friend) => {
						if (this._userToSocket.has(friend.id)) {
							this._userToSocket.get(friend.id)!.send(JSON.stringify(msg));
						}
					});
				});
			}
		}
	}

	public notify(message: OutboundWSMessage, recipient: number): void {
		if (this._userToSocket.has(recipient)) {
			this._userToSocket.get(recipient)!.send(JSON.stringify(message));
		}
	}

	public broadcast(message: OutboundWSMessage): void {
		this._userToSocket.forEach((socket) => {
			socket.send(JSON.stringify(message));
		});
	}

	public logEvent(evt: LogEntry): void {
		this._eventLog.push(evt);
	}

	public getMessageLog(): LogEntry[] {
		return this._eventLog;
	}

	public clearLog(): void {
		this._eventLog = [];
	}

	public isOnline(id: number): boolean {
		return this._statuses.get(id) === 'ONLINE';
	}

	public setStatus(id: number, status: UserStatus): void {
		this._statuses.set(id, status);
	}

	public hasSocket(id: number): boolean {
		return this._userToSocket.has(id);
	}
}


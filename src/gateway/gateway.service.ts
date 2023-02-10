import { Injectable, Logger } from '@nestjs/common';
import { DBService } from 'src/db/db.service';
import { User } from 'src/models/User.model';
import { WebSocket } from 'ws';
import { OutboundWSMessage } from './messages.model';

@Injectable()
export class GatewayService {
	private _logger: Logger;
	private _socketToUser: Map<WebSocket, number> = new Map();
	private _userToSocket: Map<number, WebSocket> = new Map();

	constructor(private readonly dbService: DBService) {
		this._logger = new Logger('GatewayService');
	}

	public addSocket(socket: WebSocket, user: User): void {
		this._socketToUser.set(socket, user.id);
		this._userToSocket.set(user.id, socket);
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
		}
	}

	public broadcast(message: OutboundWSMessage): void {
		this._userToSocket.forEach((socket) => {
			socket.send(JSON.stringify(message));
		});
	}
}


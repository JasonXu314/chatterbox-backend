import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DBService } from 'src/db/db.service';
import { User } from 'src/users/User.model';
import { WebSocket } from 'ws';

@Injectable()
export class GatewayService {
	private _logger: Logger;
	private _socketToUser: Map<WebSocket, number> = new Map();
	private _userToSocket: Map<number, WebSocket> = new Map();
	private _uuidToUser: Map<string, number> = new Map();
	private _userIntervals: Map<number, NodeJS.Timeout> = new Map();

	constructor(private readonly dbService: DBService) {
		this._logger = new Logger('GatewayService');
	}

	public allocateUUID(user: User): string {
		const uuid = randomUUID();

		this._logger.log(`Allocated UUID ${uuid} for user ${user.username}`);

		this._uuidToUser.set(uuid, user.id);

		const interval = setTimeout(() => {
			this._logger.log(`UUID ${uuid} for user ${user.username} has expired`);
			this._uuidToUser.delete(uuid);
		}, 5000);

		this._userIntervals.set(user.id, interval);

		return uuid;
	}

	public async claimUUID(socket: WebSocket, uuid: string): Promise<boolean> {
		const userId = this._uuidToUser.get(uuid);

		if (!userId) {
			// UUID has expired (or did not exist in the first place)
			return false;
		}

		const user = (await this.dbService.getUsers(userId))[0];

		if (!user) {
			this._logger.error(`User with ID ${userId} does not exist!`);
			return false;
		}

		this._logger.log(`Claimed UUID ${uuid} for user ${user.username}`);

		this._socketToUser.set(socket, user.id);
		this._userToSocket.set(user.id, socket);

		clearTimeout(this._userIntervals.get(user.id));
		this._userIntervals.delete(user.id);

		return true;
	}

	public closeSocket(socket: WebSocket): void {
		const userId = this._socketToUser.get(socket);

		if (userId) {
			this._socketToUser.delete(socket);
			this._userToSocket.delete(userId);
		}
	}
}


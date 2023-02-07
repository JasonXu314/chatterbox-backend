import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import { DBService } from 'src/db/db.service';
import { WebSocket } from 'ws';
import { GatewayService } from './gateway.service';
import { WSClaimMessage, WSMessage } from './messages.model';

@WebSocketGateway()
export class GatewayController implements OnGatewayConnection, OnGatewayDisconnect {
	private readonly logger = new Logger('WS Gateway');

	constructor(private readonly gatewayService: GatewayService, private readonly dbService: DBService) {}

	public handleConnection(client: WebSocket) {
		client.addEventListener(
			'message',
			async (evt) => {
				const msg: WSMessage = JSON.parse(evt.data.toString());

				switch (msg.type) {
					case 'CLAIM':
						await this.authClient(client, msg);
						break;
					default:
						client.close(4000, 'Invalid message type; must first send CLAIM message');
						break;
				}
			},
			{ once: true }
		);
	}

	private async authClient(client: WebSocket, claimMessage: WSClaimMessage): Promise<void> {
		const success = await this.gatewayService.claimUUID(client, claimMessage.uuid);

		if (success) {
			client.send(JSON.stringify({ type: 'CLAIM_SUCCESS' }));

			client.addEventListener('message', async (evt) => {
				const msg: WSMessage = JSON.parse(evt.data.toString());

				switch (msg.type) {
					case 'SEND':
						this.logger.log('sent message: ' + msg.message);
						const author = await this.gatewayService.getUser(client);

						if (author) {
							const newMessage = this.dbService.createMessage(author, msg.message, msg.channelId);
						} else {
							client.close(5000, 'Socket not mapped to user');
						}
						break;
					default:
						client.close(4000, 'Invalid message type');
						break;
				}
			});
		} else {
			client.close(4000, 'Invalid UUID');
		}
	}

	public handleDisconnect(client: WebSocket) {
		client.removeAllListeners();

		this.gatewayService.closeSocket(client);
	}
}


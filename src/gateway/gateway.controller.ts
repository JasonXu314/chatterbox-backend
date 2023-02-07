import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import { WebSocket } from 'ws';
import { GatewayService } from './gateway.service';
import { WSMessage } from './messages.model';

@WebSocketGateway()
export class GatewayController implements OnGatewayConnection, OnGatewayDisconnect {
	private readonly logger = new Logger('WS Gateway');

	constructor(private readonly gatewayService: GatewayService) {}

	public handleConnection(client: WebSocket) {
		client.addEventListener(
			'message',
			async (evt) => {
				const msg: WSMessage = JSON.parse(evt.data.toString());

				switch (msg.type) {
					case 'CLAIM':
						const success = await this.gatewayService.claimUUID(client, msg.uuid);

						if (success) {
							client.send(JSON.stringify({ type: 'CLAIM_SUCCESS' }));

							client.addEventListener('message', async (evt) => {
								const msg: WSMessage = JSON.parse(evt.data.toString());

								switch (msg.type) {
									case 'SEND':
										console.log('sent message: ' + msg.message);
										break;
									default:
										client.close(4000, 'Invalid message type');
										break;
								}
							});
						} else {
							client.close(4000, 'Invalid UUID');
						}

						break;
					default:
						client.close(4000, 'Invalid message type; must first send CLAIM message');
						break;
				}
			},
			{ once: true }
		);
	}

	public handleDisconnect(client: WebSocket) {
		client.removeAllListeners();

		this.gatewayService.closeSocket(client);
	}
}


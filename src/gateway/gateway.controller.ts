import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import { DBService } from 'src/db/db.service';
import { MessageEvent, WebSocket } from 'ws';
import { GatewayService } from './gateway.service';
import { InboundWSMessage, WSClaimMessage } from './messages.model';

@WebSocketGateway()
export class GatewayController implements OnGatewayConnection, OnGatewayDisconnect {
	private readonly logger = new Logger('WS Gateway');

	constructor(private readonly gatewayService: GatewayService, private readonly dbService: DBService) {}

	public handleConnection(client: WebSocket) {
		let timeoutId: NodeJS.Timeout;

		const listener = async (evt: MessageEvent) => {
			const msg: InboundWSMessage = JSON.parse(evt.data.toString());

			this.gatewayService.logEvent({ event: 'recv', message: msg });

			switch (msg.type) {
				case 'CONNECT':
					const success = await this.authClient(client, msg);

					if (success) {
						clearTimeout(timeoutId);
					}

					break;
				default:
					this.gatewayService.logEvent({ event: 'kill', message: `Invalid message (${msg})` });
					client.close(4000, 'Invalid message type; must first send CLAIM message');
					break;
			}
		};

		client.addEventListener('message', listener, { once: true });

		timeoutId = setTimeout(() => {
			this.gatewayService.logEvent({ event: 'kill', message: 'Socket timeout' });
			client.close(4000, 'Timed out');
		}, 5000);
	}

	private async authClient(client: WebSocket, connectMessage: WSClaimMessage): Promise<boolean> {
		const user = await this.dbService.getUserByToken(connectMessage.token);

		if (!user) {
			this.gatewayService.logEvent({ event: 'kill', message: `Invalid token (${connectMessage.token})` });
			client.close(4000, 'Invalid Token');
			return false;
		} else {
			this.gatewayService.addSocket(client, user);
			client.send(JSON.stringify({ type: 'CONNECT_SUCCESS' }));

			client.addEventListener('message', async (evt) => {
				try {
					const msg: InboundWSMessage = JSON.parse(evt.data.toString());

					this.gatewayService.logEvent({ event: 'recv', message: msg });

					await this.handleClientMessages(msg, client);
				} catch (err) {
					this.gatewayService.logEvent({ event: 'kill', message: `Invalid message format (${evt.data})` });
					client.close(4000, 'Invalid message (messages must be in json format)');
				}
			});

			return true;
		}
	}

	private async handleClientMessages(msg: InboundWSMessage, client: WebSocket): Promise<void> {
		switch (msg.type) {
			case 'SEND':
				const author = await this.gatewayService.getUser(client);

				if (!author) {
					this.logger.log('Shit happened...');
					this.gatewayService.logEvent({ event: 'recv', message: msg });
					this.gatewayService.logEvent({ event: 'error', message: '^ Author should not be null...' });
					return;
				}

				this.logger.log(`${author.username} sent message ${msg.message} in channel ${msg.channelId}`);
				this.gatewayService.logEvent({ event: 'recv', message: msg });

				if (author) {
					const newMessage = await this.dbService.createMessage(author, msg.message, msg.channelId);

					this.gatewayService.broadcast({ type: 'MESSAGE', message: newMessage });
				} else {
					client.close(5000, 'Socket not mapped to user');
				}
				break;
			default:
				this.gatewayService.logEvent({ event: 'kill', message: `Invalid message type (${JSON.stringify(msg)})` });
				client.close(4000, 'Invalid message type');
				break;
		}
	}

	public handleDisconnect(client: WebSocket) {
		client.removeAllListeners();

		this.gatewayService.getUser(client).then((user) => {
			if (!user) {
				this.logger.log('Shit happened...');
				this.gatewayService.logEvent({ event: 'close', message: 'Socket closed, unknown user' });
			} else {
				this.gatewayService.logEvent({ event: 'close', message: `Socket closed (belonging to ${user.username}, id ${user.id})` });
			}
		});
		this.gatewayService.closeSocket(client);
	}
}


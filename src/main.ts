import { config } from 'dotenv';

config({ path: '.env' });

import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	app.useWebSocketAdapter(new WsAdapter(app));
	app.enableCors({ origin: true });

	await app.listen(process.env.PORT || 8888);
}

bootstrap();


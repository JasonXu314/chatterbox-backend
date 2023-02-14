import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { config } from 'dotenv';
import { AppModule } from './app.module';

config({ path: '.env' });

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	app.useWebSocketAdapter(new WsAdapter(app));
	app.enableCors({ origin: true });

	await app.listen(process.env.PORT || 8888);
}

bootstrap();


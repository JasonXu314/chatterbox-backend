import { config } from 'dotenv';

config({ path: '.env' });

import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import * as sgMail from '@sendgrid/mail';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	app.useWebSocketAdapter(new WsAdapter(app));
	app.enableCors({ origin: true });

	sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

	await app.listen(process.env.PORT || 8888);
}

bootstrap();


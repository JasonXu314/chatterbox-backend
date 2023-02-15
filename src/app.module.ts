import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CDNModule } from './cdn/cdn.module';
import { DBModule } from './db/db.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
	imports: [GatewayModule, DBModule, CDNModule],
	controllers: [AppController],
	providers: []
})
export class AppModule {}


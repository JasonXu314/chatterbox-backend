import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DBModule } from './db/db.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
	imports: [GatewayModule, DBModule],
	controllers: [AppController],
	providers: []
})
export class AppModule {}


import { Module } from '@nestjs/common';
import { DBModule } from 'src/db/db.module';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';

@Module({
	imports: [DBModule],
	controllers: [],
	providers: [GatewayController, GatewayService],
	exports: [GatewayService]
})
export class GatewayModule {}


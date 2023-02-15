import { Module } from '@nestjs/common';
import { CDNController } from './cdn.controller';
import { CDNService } from './cdn.service';

@Module({
	imports: [],
	controllers: [CDNController],
	providers: [CDNService],
	exports: [CDNService]
})
export class CDNModule {}


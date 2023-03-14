import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { CDNService } from './cdn.service';

@Controller({ path: 'cdn' })
export class CDNController {
	constructor(private readonly cdnService: CDNService) {}

	@Get('/avatar/:file')
	public getAvatar(@Param('file') path: string): StreamableFile {
		return this.cdnService.readAvatar(path);
	}
}


import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { nanoid } from 'nanoid';

@Injectable()
export class CDNService {
	constructor() {
		const ensureDirs = ['./cdn', './cdn/avatars', './cdn/files'];

		ensureDirs.forEach((dir) => {
			if (!existsSync(dir)) {
				mkdirSync(dir);
			}
		});
	}

	public readAvatar(path: string): StreamableFile {
		const fullPath = `./cdn/avatars/${path}`,
			extension = fullPath.slice(fullPath.lastIndexOf('.') + 1);

		if (existsSync(fullPath)) {
			return new StreamableFile(createReadStream(fullPath), { type: this._getMIMEType(extension) });
		} else {
			throw new NotFoundException('No avatar found with specified path');
		}
	}

	public saveAvatar(file: Express.Multer.File): string {
		const id = nanoid();

		const extension = file.originalname.slice(file.originalname.lastIndexOf('.') + 1);

		writeFileSync(`./cdn/avatars/${id}.${extension}`, file.buffer);

		return `${id}.${extension}`;
	}

	private _getMIMEType(extension: string): string {
		switch (extension) {
			case 'png':
				return 'image/png';
			case 'jpg':
			case 'jpeg':
				return 'image/jpeg';
			default:
				return 'text/plain';
		}
	}
}


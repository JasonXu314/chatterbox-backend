import { IsDefined, IsInt, IsString } from 'class-validator';
import { User } from './User.model';
import { forceInit } from './utils';

export class FriendRequestResponseDTO {
	from: User | null = null;
	timestamp: string = '';
}

export class FriendRequestDTO {
	@IsDefined()
	@IsString()
	token: string = forceInit();

	@IsInt()
	friendId?: number;

	@IsString()
	username?: string;
}


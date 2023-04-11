import { User } from './User.model';

export class FriendRequestResponseDTO {
	from: User | null = null;
	timestamp: string = '';
}


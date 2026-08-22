import { UserRole } from '../entities/user.entity';

export class PublicUserDto {
  id!: string;
  name!: string;
  email!: string;
  role!: UserRole;
  createdAt!: Date;
}

export class AuthResponseDto {
  accessToken!: string;
  user!: PublicUserDto;
}

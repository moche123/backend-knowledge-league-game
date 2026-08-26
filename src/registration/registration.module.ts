import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Registration } from './entities/registration.entity';
import { Tournament } from '../tournament/entities/tournament.entity';
import { User } from '../auth/entities/user.entity';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';

@Module({
  imports: [TypeOrmModule.forFeature([Registration, Tournament, User])],
  controllers: [RegistrationController],
  providers: [RegistrationService],
})
export class RegistrationModule {}

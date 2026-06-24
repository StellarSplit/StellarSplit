import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from './invitation.entity';
import { Participant } from '../entities/participant.entity';
import { Split } from '../entities/split.entity';
import { User } from '../entities/user.entity';
import { CommonModule } from '../common/common.module';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invitation, Participant, Split, User]),
    CommonModule,
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}

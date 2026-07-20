import { Module } from '@nestjs/common';
import { ArchivesService } from './archives.service';
import { ArchivesController } from './archives.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [ArchivesService],
  controllers: [ArchivesController],
  exports: [ArchivesService],
})
export class ArchivesModule {}

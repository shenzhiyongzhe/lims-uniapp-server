import { Module } from '@nestjs/common';
import { ArchivesService } from './archives.service';
import { ArchivesController } from './archives.controller';

@Module({
  providers: [ArchivesService],
  controllers: [ArchivesController],
  exports: [ArchivesService],
})
export class ArchivesModule {}

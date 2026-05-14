import { Module } from '@nestjs/common';
import { ChangelogsService } from './changelogs.service';
import { ChangelogsController } from './changelogs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [ChangelogsService],
  controllers: [ChangelogsController],
})
export class ChangelogsModule {}

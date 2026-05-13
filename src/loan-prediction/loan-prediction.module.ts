import { Module } from '@nestjs/common';
import { LoanPredictionController } from './loan-prediction.controller';
import { LoanPredictionService } from './loan-prediction.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LoanPredictionController],
  providers: [LoanPredictionService],
  exports: [LoanPredictionService],
})
export class LoanPredictionModule {}

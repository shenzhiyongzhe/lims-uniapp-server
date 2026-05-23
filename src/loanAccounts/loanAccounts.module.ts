import { Module } from '@nestjs/common';
import { LoanAccountsController } from './loanAccounts.controller';
import { LoanAccountsService } from './loanAccounts.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LoanPredictionModule } from '../loan-prediction/loan-prediction.module';
import { AssetManagementModule } from '../asset-management/asset-management.module';
import { AccessScopeModule } from '../access-scope/access-scope.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    LoanPredictionModule,
    AssetManagementModule,
    AccessScopeModule,
  ],
  controllers: [LoanAccountsController],
  providers: [LoanAccountsService],
})
export class LoanAccountsModule {}

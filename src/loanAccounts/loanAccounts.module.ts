import { Module } from '@nestjs/common';
import { LoanAccountsController } from './loanAccounts.controller';
import { LoanAccountsService } from './loanAccounts.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LoanPredictionModule } from '../loan-prediction/loan-prediction.module';
import { AssetManagementModule } from '../asset-management/asset-management.module';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { ArchivesModule } from '../archives/archives.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    LoanPredictionModule,
    AssetManagementModule,
    AccessScopeModule,
    ArchivesModule,
  ],
  controllers: [LoanAccountsController],
  providers: [LoanAccountsService],
  exports: [LoanAccountsService],
})
export class LoanAccountsModule {}

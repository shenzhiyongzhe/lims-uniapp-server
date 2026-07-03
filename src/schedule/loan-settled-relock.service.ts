import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LoanAccountsService } from '../loanAccounts/loanAccounts.service';

@Injectable()
export class LoanSettledRelockService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LoanSettledRelockService.name);

  constructor(private readonly loanAccountsService: LoanAccountsService) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Running settled loan relock sweep on server startup');
    try {
      await this.relockExpiredSettledLoans();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown relock sweep error';
      this.logger.error(`Settled relock sweep on startup failed: ${message}`);
    }
  }

  @Cron('0 * * * * *')
  async relockExpiredSettledLoans(): Promise<void> {
    const count = await this.loanAccountsService.relockExpiredSettledLoans();
    if (count > 0) {
      this.logger.log(`Settled relock sweep: re-locked ${count} loan(s)`);
    }
  }
}

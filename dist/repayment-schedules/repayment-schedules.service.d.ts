import { PrismaService } from '../prisma/prisma.service';
import { RepaymentSchedule } from '@prisma/client';
import { RepaymentScheduleResponseDto } from './dto/repayment-schedule-response.dto';
export declare class RepaymentSchedulesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByLoanId(loanId: number): Promise<RepaymentSchedule[]>;
    findById(id: number): Promise<RepaymentSchedule | null>;
    update(data: Partial<RepaymentSchedule> & {
        pay_capital?: number;
        pay_interest?: number;
        fines?: number;
        remark?: string;
    }, operatorAdminId?: number): Promise<RepaymentSchedule>;
    create(loanId: number): Promise<RepaymentSchedule>;
    toResponse(schedule: any): RepaymentScheduleResponseDto;
}

import { PrismaService } from '../prisma/prisma.service';
import { RepaymentSchedule } from '@prisma/client';
type ScheduleOperationType = 'collect' | 'edit';
import { RepaymentScheduleResponseDto } from './dto/repayment-schedule-response.dto';
export declare class RepaymentSchedulesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private get operationLogDelegate();
    findByLoanId(loanId: number): Promise<RepaymentSchedule[]>;
    findById(id: number): Promise<RepaymentSchedule | null>;
    findOperationLogs(scheduleId: number): Promise<{
        id: number;
        schedule_id: number;
        loan_id: number;
        action_type: ScheduleOperationType;
        operator_admin_id: number | null;
        operator_admin_name: string | null;
        paid_capital_before: number | null;
        paid_interest_before: number | null;
        fines_before: number | null;
        paid_capital_after: number | null;
        paid_interest_after: number | null;
        fines_after: number | null;
        remark: string | null;
        created_at: Date;
    }[]>;
    update(data: Partial<RepaymentSchedule> & {
        pay_capital?: number;
        pay_interest?: number;
        fines?: number;
        remark?: string;
        action_type?: ScheduleOperationType | string;
    }, operatorAdminId?: number): Promise<RepaymentSchedule>;
    create(loanId: number): Promise<RepaymentSchedule>;
    toResponse(schedule: any): RepaymentScheduleResponseDto;
}
export {};

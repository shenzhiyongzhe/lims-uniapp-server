import { RepaymentSchedulesService } from './repayment-schedules.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';
export declare class RepaymentSchedulesController {
    private readonly repaymentSchedulesService;
    constructor(repaymentSchedulesService: RepaymentSchedulesService);
    findOperationLogs(id: number): Promise<ApiResponseDto>;
    findById(id: number): Promise<ApiResponseDto>;
    create(data: {
        loan_id: number | string;
    }): Promise<ApiResponseDto>;
    update(data: any, user: {
        id: number;
    }): Promise<ApiResponseDto>;
}

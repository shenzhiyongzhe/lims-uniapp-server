import { LoanAccountsService } from './loanAccounts.service';
import { CreateLoanAccountDto } from './dto/create-loanAccount.dto';
import { UpdateLoanAccountDto } from './dto/update-loanAccount.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';
export declare class LoanAccountsController {
    private readonly loanAccountsService;
    constructor(loanAccountsService: LoanAccountsService);
    findAll(): Promise<ApiResponseDto>;
    findRelatedAdmins(): Promise<ApiResponseDto>;
    findGroupedByUser(page: string, pageSize: string, status?: string, adminId?: string, keyword?: string, username?: string, listFilter?: string, user?: {
        id: number;
        role: string;
    }): Promise<ApiResponseDto>;
    findById(id: number): Promise<ApiResponseDto>;
    create(body: CreateLoanAccountDto, user: {
        id: number;
    }): Promise<ApiResponseDto>;
    update(id: number, body: UpdateLoanAccountDto): Promise<ApiResponseDto>;
}

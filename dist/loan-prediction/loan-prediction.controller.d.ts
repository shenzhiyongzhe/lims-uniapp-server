import { LoanPredictionService } from './loan-prediction.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';
export declare class LoanPredictionController {
    private readonly loanPredictionService;
    constructor(loanPredictionService: LoanPredictionService);
    getPredictions(field: string, prefix?: string): Promise<ApiResponseDto>;
}

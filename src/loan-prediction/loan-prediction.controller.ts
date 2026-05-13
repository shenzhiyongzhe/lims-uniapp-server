import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LoanPredictionService } from './loan-prediction.service';
import { AuthGuard } from '../auth/auth.guard';
import { ResponseHelper } from '../common/response-helper';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@Controller('loan-prediction')
@UseGuards(AuthGuard)
export class LoanPredictionController {
  constructor(private readonly loanPredictionService: LoanPredictionService) {}

  @Get(':field')
  async getPredictions(
    @Param('field') field: string,
    @Query('prefix') prefix?: string,
  ): Promise<ApiResponseDto> {
    const predictions = await this.loanPredictionService.getPredictions(
      field,
      prefix,
    );
    return ResponseHelper.success(predictions, '获取预测数据成功');
  }
}

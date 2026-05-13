import { UsersService } from './users.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    search(search: string): Promise<ApiResponseDto>;
    create(username: string): Promise<ApiResponseDto>;
}

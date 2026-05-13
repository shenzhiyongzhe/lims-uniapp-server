import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    search(search: string): Promise<User[]>;
    create(username: string): Promise<User>;
}

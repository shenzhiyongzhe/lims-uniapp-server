import { Injectable, NotFoundException } from '@nestjs/common';
import { FeedbackStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { QueryFeedbackDto } from './dto/query-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(staffId: number, dto: CreateFeedbackDto) {
    const row = await this.prisma.feedback.create({
      data: {
        staff_id: staffId,
        type: dto.type,
        content: dto.content.trim(),
      },
      include: {
        staff: {
          select: { nickname: true, username: true },
        },
      },
    });
    return this.toFeedbackItem(row);
  }

  async findAll(query: QueryFeedbackDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = query.status ? { status: query.status } : {};

    const [rows, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          staff: {
            select: { nickname: true, username: true },
          },
        },
      }),
      this.prisma.feedback.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toFeedbackItem(row)),
      total,
      page,
      pageSize,
    };
  }

  async updateStatus(id: number, status: FeedbackStatus) {
    const existing = await this.prisma.feedback.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('反馈不存在');
    }

    const row = await this.prisma.feedback.update({
      where: { id },
      data: { status },
      include: {
        staff: {
          select: { nickname: true, username: true },
        },
      },
    });
    return this.toFeedbackItem(row);
  }

  private toFeedbackItem(row: {
    id: number;
    staff_id: number;
    type: string;
    status: string;
    content: string;
    created_at: Date;
    updated_at: Date;
    staff: { nickname: string | null; username: string | null } | null;
  }) {
    return {
      id: row.id,
      staffId: row.staff_id,
      type: row.type,
      status: row.status,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      submitterName:
        row.staff?.nickname?.trim() ||
        row.staff?.username?.trim() ||
        '未知用户',
    };
  }
}

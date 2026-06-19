import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Workbook } from 'exceljs';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  private formatDate(date: any, includeTime = false): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    if (!includeTime) return `${y}-${m}-${day}`;
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}:${s}`;
  }

  private toNum(val: any): number {
    if (val === null || val === undefined) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }

  private translateLoanStatus(status: string): string {
    const statuses: Record<string, string> = {
      pending: '待还款',
      active: '进行中',
      overdue: '已逾期',
      settled: '已结清',
      unsettled: '未结清',
      negotiated: '协商中',
      to_be_processed: '待处理',
      blacklist: '黑名单',
    };
    return statuses[status] || status;
  }

  private translateScheduleStatus(status: string): string {
    const statuses: Record<string, string> = {
      pending: '待还款',
      active: '进行中',
      overdue: '已逾期',
      paid: '已还款',
      terminated: '已终止',
    };
    return statuses[status] || status;
  }

  private translateRole(role: string): string {
    const roles: Record<string, string> = {
      SUPER_ADMIN: '超级管理员',
      ADMIN: '管理员',
      RISK_CONTROLLER: '风控员',
      COLLECTOR: '负责人',
      PENDING: '待审核',
    };
    return roles[role] || role;
  }

  async getBackupFiles() {
    const backupsDir = path.join(process.cwd(), 'backups');
    await fs.mkdir(backupsDir, { recursive: true });
    const files = await fs.readdir(backupsDir);
    const list = [];
    for (const file of files) {
      if (file.endsWith('.xlsx')) {
        const filePath = path.join(backupsDir, file);
        const stat = await fs.stat(filePath);
        list.push({
          filename: file,
          size: stat.size,
          createdAt: stat.birthtime || stat.mtime,
        });
      }
    }
    // Sort descending by creation date
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteBackupFile(filename: string) {
    const backupsDir = path.join(process.cwd(), 'backups');
    // Security check to prevent path traversal
    const safeName = path.basename(filename);
    const filePath = path.join(backupsDir, safeName);
    await fs.unlink(filePath);
    return true;
  }

  async createBackupExcel(): Promise<string> {
    const backupsDir = path.join(process.cwd(), 'backups');
    await fs.mkdir(backupsDir, { recursive: true });

    const timestamp = this.formatDate(new Date(), true)
      .replace(/[- :]/g, '')
      .slice(0, 14);
    const filename = `backup_${timestamp}.xlsx`;
    const filePath = path.join(backupsDir, filename);

    const workbook = new Workbook();

    // 1. Unified Business Data Sheet (User + LoanAccount)
    const sheetUnified = workbook.addWorksheet('整合业务数据');
    sheetUnified.columns = [
      { header: '用户ID', key: 'user_id', width: 10 },
      { header: '用户名', key: 'username', width: 15 },
      { header: '超时时间', key: 'overtime', width: 10 },
      { header: '逾期天数', key: 'overdue_time', width: 10 },
      { header: '是否高风险', key: 'is_high_risk', width: 12 },
      { header: '用户创建时间', key: 'user_createdAt', width: 20 },

      { header: '贷款账户ID', key: 'loan_id', width: 12 },
      { header: '贷款金额', key: 'loan_amount', width: 12 },
      { header: '到手金额', key: 'receiving_amount', width: 12 },
      { header: '扣除比例', key: 'to_hand_ratio', width: 10 },
      { header: '首期本金', key: 'capital', width: 12 },
      { header: '首期利息', key: 'interest', width: 12 },
      { header: '应还起始日', key: 'due_start_date', width: 15 },
      { header: '应还截止日', key: 'due_end_date', width: 15 },
      { header: '贷款状态', key: 'status', width: 12 },
      { header: '后扣', key: 'handling_fee', width: 12 },
      { header: '总期数', key: 'total_periods', width: 10 },
      { header: '已还期数', key: 'repaid_periods', width: 10 },
      { header: '日还金额', key: 'daily_repayment', width: 12 },
      { header: '公司成本', key: 'company_cost', width: 12 },
      { header: '贷款创建时间', key: 'loan_created_at', width: 20 },
      { header: '负责人ID', key: 'collector_id', width: 10 },
      { header: '风控人ID', key: 'risk_controller_id', width: 10 },
      { header: '申请次数', key: 'apply_times', width: 10 },
      { header: '已还本金', key: 'paid_capital', width: 12 },
      { header: '已还利息', key: 'paid_interest', width: 12 },
      { header: '总罚金', key: 'total_fines', width: 12 },
      { header: '所有权', key: 'ownership', width: 10 },
      { header: '付款人姓名', key: 'payer_name', width: 15 },
      { header: '贷款备注', key: 'note', width: 25 },
    ];

    const loans = await this.prisma.loanAccount.findMany({
      include: {
        user: true,
      },
      orderBy: { id: 'desc' },
    });

    for (const loan of loans) {
      const u = loan.user;
      sheetUnified.addRow({
        user_id: u.id,
        username: u.username,
        overtime: u.overtime ?? 0,
        overdue_time: u.overdue_time ?? 0,
        is_high_risk: u.is_high_risk ? '是' : '否',
        user_createdAt: this.formatDate(u.createdAt, true),

        loan_id: loan.id,
        loan_amount: this.toNum(loan.loan_amount),
        receiving_amount: this.toNum(loan.receiving_amount),
        to_hand_ratio: this.toNum(loan.to_hand_ratio),
        capital: this.toNum(loan.period_capital),
        interest: this.toNum(loan.period_interest),
        due_start_date: this.formatDate(loan.due_start_date, false),
        due_end_date: this.formatDate(loan.due_end_date, false),
        status: this.translateLoanStatus(loan.status),
        handling_fee: this.toNum(loan.handling_fee),
        total_periods: loan.total_periods,
        repaid_periods: loan.repaid_periods,
        daily_repayment: loan.daily_repayment,
        company_cost: loan.company_cost,
        loan_created_at: this.formatDate(loan.created_at, true),
        collector_id: loan.collector_id,
        risk_controller_id: loan.risk_controller_id,
        apply_times: loan.apply_times,
        paid_capital: this.toNum(loan.paid_capital),
        paid_interest: this.toNum(loan.paid_interest),
        total_fines: this.toNum(loan.total_fines),
        ownership: loan.ownership || '',
        payer_name: loan.payer_name || '',
        note: loan.note || '',
      });
    }

    // 2. Repayment Schedule & Record Sheet
    const sheetSchedAndRecords = workbook.addWorksheet('还款计划与记录');
    sheetSchedAndRecords.columns = [
      { header: '贷款账户ID', key: 'loan_id', width: 12 },
      { header: '用户名', key: 'username', width: 15 },
      { header: '计划ID', key: 'schedule_id', width: 10 },
      { header: '期数', key: 'period', width: 8 },
      { header: '期数应还金额', key: 'due_amount', width: 12 },
      { header: '期数本金', key: 'schedule_capital', width: 12 },
      { header: '期数利息', key: 'schedule_interest', width: 12 },
      { header: '期数状态', key: 'schedule_status', width: 12 },
      { header: '期数已还金额', key: 'schedule_paid_amount', width: 12 },
      { header: '期数实际还款时间', key: 'schedule_paid_at', width: 20 },
      { header: '期数罚金', key: 'schedule_fines', width: 12 },
      { header: '期数已还本金', key: 'schedule_paid_capital', width: 12 },
      { header: '期数已还利息', key: 'schedule_paid_interest', width: 12 },
      { header: '操作人姓名', key: 'operator_admin_name', width: 15 },

      { header: '还款记录ID', key: 'record_id', width: 12 },
      { header: '还款金额', key: 'record_paid_amount', width: 12 },
      { header: '实际付款时间', key: 'record_paid_at', width: 20 },
      { header: '已还本金', key: 'record_paid_capital', width: 12 },
      { header: '已还利息', key: 'record_paid_interest', width: 12 },
      { header: '已还罚金', key: 'record_paid_fines', width: 12 },
      { header: '实际催收人ID', key: 'record_actual_collector_id', width: 15 },
      { header: '是否逾期还款', key: 'record_is_overdue_repaid', width: 15 },
      { header: '备注', key: 'record_remark', width: 20 },
      { header: '计划到期日', key: 'record_due_date', width: 15 },
    ];

    const schedules = await this.prisma.repaymentSchedule.findMany({
      include: {
        repaymentRecords: true,
        loan_account: {
          include: {
            user: true,
          },
        },
      },
      orderBy: [{ loan_id: 'desc' }, { period: 'asc' }],
    });

    for (const s of schedules) {
      const loan = s.loan_account;
      const username = loan?.user?.username || '';

      const baseRow = {
        loan_id: s.loan_id,
        username: username,
        schedule_id: s.id,
        period: s.period,
        due_amount: this.toNum(s.due_amount),
        schedule_capital: this.toNum(s.capital),
        schedule_interest: this.toNum(s.interest),
        schedule_status: this.translateScheduleStatus(s.status),
        schedule_paid_amount: this.toNum(s.paid_amount),
        schedule_paid_at: this.formatDate(s.paid_at, true),
        schedule_fines: this.toNum(s.fines),
        schedule_paid_capital: this.toNum(s.paid_capital),
        schedule_paid_interest: this.toNum(s.paid_interest),
        operator_admin_name: s.operator_admin_name || '',
      };

      if (s.repaymentRecords.length === 0) {
        sheetSchedAndRecords.addRow({
          ...baseRow,
        });
      } else {
        for (const r of s.repaymentRecords) {
          sheetSchedAndRecords.addRow({
            ...baseRow,
            record_id: r.id,
            record_paid_amount: this.toNum(r.paid_amount),
            record_paid_at: this.formatDate(r.paid_at, true),
            record_paid_capital: this.toNum(r.paid_capital),
            record_paid_interest: this.toNum(r.paid_interest),
            record_paid_fines: this.toNum(r.paid_fines),
            record_actual_collector_id: r.actual_collector_id || '',
            record_is_overdue_repaid: r.is_overdue_repaid ? '是' : '否',
            record_remark: r.remark || '',
            record_due_date: this.formatDate(r.due_date, false),
          });
        }
      }
    }

    // 3. Staff List Sheet
    const sheetStaffs = workbook.addWorksheet('员工列表');
    sheetStaffs.columns = [
      { header: '员工ID', key: 'id', width: 10 },
      { header: '用户名', key: 'username', width: 15 },
      { header: '昵称', key: 'nickname', width: 15 },
      { header: '角色', key: 'role', width: 15 },
      { header: 'OpenID', key: 'openid', width: 30 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '更新时间', key: 'updatedAt', width: 20 },
      { header: '最后登录时间', key: 'last_login_at', width: 20 },
      { header: '登录IP', key: 'last_login_ip', width: 15 },
    ];
    const staffs = await this.prisma.staff.findMany({ orderBy: { id: 'asc' } });
    for (const staff of staffs) {
      sheetStaffs.addRow({
        id: staff.id,
        username: staff.username || '',
        nickname: staff.nickname || '',
        role: this.translateRole(staff.role),
        openid: staff.openid || '',
        createdAt: this.formatDate(staff.createdAt, true),
        updatedAt: this.formatDate(staff.updatedAt, true),
        last_login_at: this.formatDate(staff.last_login_at, true),
        last_login_ip: staff.last_login_ip || '',
      });
    }

    // 4. Repayment Schedule Operation Log Sheet
    const sheetSchedLogs = workbook.addWorksheet('还款计划操作日志');
    sheetSchedLogs.columns = [
      { header: '日志ID', key: 'id', width: 10 },
      { header: '计划ID', key: 'schedule_id', width: 10 },
      { header: '贷款ID', key: 'loan_id', width: 10 },
      { header: '操作类型', key: 'action_type', width: 12 },
      { header: '操作人ID', key: 'operator_admin_id', width: 10 },
      { header: '操作人姓名', key: 'operator_admin_name', width: 15 },
      { header: '变动前本金', key: 'paid_capital_before', width: 12 },
      { header: '变动前利息', key: 'paid_interest_before', width: 12 },
      { header: '变动前罚金', key: 'fines_before', width: 12 },
      { header: '变动后本金', key: 'paid_capital_after', width: 12 },
      { header: '变动后利息', key: 'paid_interest_after', width: 12 },
      { header: '变动后罚金', key: 'fines_after', width: 12 },
      { header: '发生时间', key: 'created_at', width: 20 },
      { header: '备注', key: 'remark', width: 20 },
    ];
    const schedLogs = await this.prisma.repaymentScheduleOperationLog.findMany({
      orderBy: { id: 'desc' },
    });
    for (const log of schedLogs) {
      sheetSchedLogs.addRow({
        id: log.id,
        schedule_id: log.schedule_id,
        loan_id: log.loan_id,
        action_type: log.action_type === 'collect' ? '催收还款' : '编辑计划',
        operator_admin_id: log.operator_admin_id || '',
        operator_admin_name: log.operator_admin_name || '',
        paid_capital_before: this.toNum(log.paid_capital_before),
        paid_interest_before: this.toNum(log.paid_interest_before),
        fines_before: this.toNum(log.fines_before),
        paid_capital_after: this.toNum(log.paid_capital_after),
        paid_interest_after: this.toNum(log.paid_interest_after),
        fines_after: this.toNum(log.fines_after),
        created_at: this.formatDate(log.created_at, true),
        remark: log.remark || '',
      });
    }

    // 5. Loan Account Operation Log Sheet
    const sheetLoanLogs = workbook.addWorksheet('贷款账户操作日志');
    sheetLoanLogs.columns = [
      { header: '日志ID', key: 'id', width: 10 },
      { header: '贷款ID', key: 'loan_id', width: 10 },
      { header: '操作人ID', key: 'operator_admin_id', width: 10 },
      { header: '操作人姓名', key: 'operator_admin_name', width: 15 },
      { header: '动作类型', key: 'action_type', width: 15 },
      { header: '日志内容', key: 'content', width: 40 },
      { header: '时间', key: 'created_at', width: 20 },
    ];
    const loanLogs = await this.prisma.loanAccountOperationLog.findMany({
      orderBy: { id: 'desc' },
    });
    for (const log of loanLogs) {
      sheetLoanLogs.addRow({
        id: log.id,
        loan_id: log.loan_id,
        operator_admin_id: log.operator_admin_id || '',
        operator_admin_name: log.operator_admin_name || '',
        action_type: log.action_type || '',
        content: log.content || '',
        created_at: this.formatDate(log.created_at, true),
      });
    }

    // 6. Daily Loan Balance Sheet
    const sheetDaily = workbook.addWorksheet('每日数据');
    sheetDaily.columns = [
      { header: '记录ID', key: 'id', width: 10 },
      { header: '管理员ID', key: 'admin_id', width: 12 },
      { header: '统计日期', key: 'date', width: 15 },
      { header: '昨日余额', key: 'previous_total', width: 15 },
      { header: '今日放款', key: 'today_loan_total', width: 15 },
      { header: '今日实收', key: 'today_repaid_total', width: 15 },
      { header: '今日结余', key: 'today_total', width: 15 },
      { header: '创建时间', key: 'created_at', width: 20 },
    ];
    const dailyBalances = await this.prisma.dailyLoanBalance.findMany({
      orderBy: { date: 'desc' },
    });
    for (const d of dailyBalances) {
      sheetDaily.addRow({
        id: d.id,
        admin_id: d.admin_id,
        date: this.formatDate(d.date, false),
        previous_total: this.toNum(d.previous_total),
        today_loan_total: this.toNum(d.today_loan_total),
        today_repaid_total: this.toNum(d.today_repaid_total),
        today_total: this.toNum(d.today_total),
        created_at: this.formatDate(d.created_at, true),
      });
    }

    // 7. Collector Asset Management Sheet
    const sheetCollAssets = workbook.addWorksheet('负责人资产');
    sheetCollAssets.columns = [
      { header: '资产ID', key: 'id', width: 10 },
      { header: '负责人ID', key: 'admin_id', width: 12 },
      { header: '总后扣费用', key: 'total_handling_fee', width: 15 },
      { header: '总罚金', key: 'total_fines', width: 15 },
      { header: '存款余额', key: 'deposit', width: 15 },
      { header: '创建时间', key: 'created_at', width: 20 },
      { header: '更新时间', key: 'updated_at', width: 20 },
    ];
    const collAssets = await this.prisma.collectorAssetManagement.findMany({
      orderBy: { id: 'asc' },
    });
    for (const ca of collAssets) {
      sheetCollAssets.addRow({
        id: ca.id,
        admin_id: ca.admin_id,
        total_handling_fee: this.toNum(ca.total_handling_fee),
        total_fines: this.toNum(ca.total_fines),
        deposit: this.toNum(ca.deposit),
        created_at: this.formatDate(ca.created_at, true),
        updated_at: this.formatDate(ca.updated_at, true),
      });
    }

    // 8.5 减资明细 Sheet
    const sheetReductions = workbook.addWorksheet('风控减资明细');
    sheetReductions.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: '风控人ID', key: 'risk_controller_id', width: 12 },
      { header: '风控人名', key: 'risk_controller_name', width: 15 },
      { header: '负责人ID', key: 'collector_id', width: 12 },
      { header: '负责人名', key: 'collector_name', width: 15 },
      { header: '减资类型', key: 'reduction_type', width: 15 },
      { header: '减资金额', key: 'amount', width: 15 },
      { header: '备注', key: 'remark', width: 25 },
      { header: '操作人ID', key: 'created_by', width: 12 },
      { header: '创建时间', key: 'created_at', width: 20 },
    ];
    const reductionTypeMap: Record<string, string> = {
      fines: '罚金',
      handling_fee: '手续费',
      amount: '本金',
    };
    const reductions = await this.prisma.riskControllerReductionRecord.findMany(
      {
        orderBy: { id: 'desc' },
        include: {
          risk_controller: { select: { username: true } },
          collector: { select: { username: true } },
        },
      },
    );
    for (const r of reductions) {
      sheetReductions.addRow({
        id: r.id,
        risk_controller_id: r.risk_controller_id,
        risk_controller_name: r.risk_controller?.username || '',
        collector_id: r.collector_id,
        collector_name: r.collector?.username || '',
        reduction_type: reductionTypeMap[r.reduction_type] || r.reduction_type,
        amount: this.toNum(r.amount),
        remark: r.remark || '',
        created_by: r.created_by || '',
        created_at: this.formatDate(r.created_at, true),
      });
    }

    // 9. Asset Reduction History Sheet
    const sheetAssetHist = workbook.addWorksheet('资产减免记录');
    sheetAssetHist.columns = [
      { header: '历史ID', key: 'id', width: 10 },
      { header: '业务员ID', key: 'admin_id', width: 12 },
      { header: '资产类型', key: 'asset_type', width: 15 },
      { header: '调整字段', key: 'field_name', width: 20 },
      { header: '变动前数值', key: 'old_value', width: 15 },
      { header: '变动金额', key: 'input_value', width: 15 },
      { header: '变动后数值', key: 'new_value', width: 15 },
      { header: '操作人ID', key: 'updated_by_admin_id', width: 12 },
      { header: '操作人用户名', key: 'updated_by_admin_username', width: 15 },
      { header: '发生时间', key: 'created_at', width: 20 },
      { header: '备注', key: 'remark', width: 25 },
    ];
    const histories = await this.prisma.assetReductionHistory.findMany({
      orderBy: { id: 'desc' },
    });
    for (const h of histories) {
      sheetAssetHist.addRow({
        id: h.id,
        admin_id: h.admin_id,
        asset_type: h.asset_type === 'collector' ? '负责人' : '风控人',
        field_name: h.field_name,
        old_value: this.toNum(h.old_value),
        input_value: this.toNum(h.input_value),
        new_value: this.toNum(h.new_value),
        updated_by_admin_id: h.updated_by_admin_id || '',
        updated_by_admin_username: h.updated_by_admin_username || '',
        created_at: this.formatDate(h.created_at, true),
        remark: h.remark || '',
      });
    }

    // 10. Deleted Loans Sheet
    const sheetDeleted = workbook.addWorksheet('历史删除贷款');
    sheetDeleted.columns = [
      { header: '自增ID', key: 'id', width: 10 },
      { header: '原贷款ID', key: 'loan_id', width: 12 },
      { header: '用户ID', key: 'user_id', width: 10 },
      { header: '用户名', key: 'username', width: 15 },
      { header: '贷款金额', key: 'loan_amount', width: 15 },
      { header: '每期本金', key: 'capital', width: 15 },
      { header: '每期利息', key: 'interest', width: 15 },
      { header: '状态', key: 'status', width: 12 },
      { header: '总期数', key: 'total_periods', width: 10 },
      { header: '已还期数', key: 'repaid_periods', width: 10 },
      { header: '应还起始', key: 'due_start_date', width: 15 },
      { header: '应还截止', key: 'due_end_date', width: 15 },
      { header: '删除时间', key: 'deleted_at', width: 20 },
      { header: '操作人ID', key: 'deleted_by', width: 12 },
    ];
    const deletedLoans = await this.prisma.deletedLoan.findMany({
      orderBy: { id: 'desc' },
    });
    for (const dl of deletedLoans) {
      sheetDeleted.addRow({
        id: dl.id,
        loan_id: dl.loan_id,
        user_id: dl.user_id,
        username: dl.username || '',
        loan_amount: this.toNum(dl.loan_amount),
        capital: this.toNum(dl.period_capital),
        interest: this.toNum(dl.period_interest),
        status: this.translateLoanStatus(dl.status),
        total_periods: dl.total_periods,
        repaid_periods: dl.repaid_periods,
        due_start_date: this.formatDate(dl.due_start_date, false),
        due_end_date: this.formatDate(dl.due_end_date, false),
        deleted_at: this.formatDate(dl.deleted_at, true),
        deleted_by: dl.deleted_by || '',
      });
    }

    // Write Excel to File System
    await workbook.xlsx.writeFile(filePath);
    this.logger.log(`Backup generated successfully: ${filePath}`);
    return filename;
  }
}

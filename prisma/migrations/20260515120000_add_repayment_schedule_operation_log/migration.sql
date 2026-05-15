-- CreateTable
CREATE TABLE `repayment_schedule_operation_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `schedule_id` INTEGER NOT NULL,
    `loan_id` INTEGER NOT NULL,
    `action_type` ENUM('collect', 'edit') NOT NULL,
    `operator_admin_id` INTEGER NULL,
    `operator_admin_name` VARCHAR(50) NULL,
    `paid_capital_before` DECIMAL(10, 2) NULL,
    `paid_interest_before` DECIMAL(10, 2) NULL,
    `fines_before` DECIMAL(10, 2) NULL,
    `paid_capital_after` DECIMAL(10, 2) NULL,
    `paid_interest_after` DECIMAL(10, 2) NULL,
    `fines_after` DECIMAL(10, 2) NULL,
    `remark` VARCHAR(10) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `repayment_schedule_operation_logs_schedule_id_idx`(`schedule_id`),
    INDEX `repayment_schedule_operation_logs_loan_id_idx`(`loan_id`),
    INDEX `repayment_schedule_operation_logs_operator_admin_id_fkey`(`operator_admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `repayment_schedule_operation_logs` ADD CONSTRAINT `repayment_schedule_operation_logs_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `repayment_schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repayment_schedule_operation_logs` ADD CONSTRAINT `repayment_schedule_operation_logs_operator_admin_id_fkey` FOREIGN KEY (`operator_admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

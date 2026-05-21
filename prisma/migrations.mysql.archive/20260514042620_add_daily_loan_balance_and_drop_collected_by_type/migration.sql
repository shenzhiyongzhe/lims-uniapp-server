-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(10) NOT NULL,
    `overtime` INTEGER NULL DEFAULT 0,
    `overdue_time` INTEGER NULL DEFAULT 0,
    `is_high_risk` BOOLEAN NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(100) NULL,
    `role` ENUM('ADMIN', 'RISK_CONTROLLER', 'COLLECTOR', 'PENDING') NOT NULL,
    `openid` VARCHAR(100) NULL,
    `nickname` VARCHAR(100) NULL,
    `avatar_url` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `token_version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `admins_openid_key`(`openid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `loan_amount` DECIMAL(10, 2) NOT NULL,
    `receiving_amount` DECIMAL(10, 2) NULL,
    `to_hand_ratio` DECIMAL(10, 2) NULL,
    `capital` DECIMAL(10, 2) NOT NULL,
    `interest` DECIMAL(10, 2) NOT NULL,
    `due_start_date` DATE NOT NULL,
    `due_end_date` DATE NOT NULL,
    `status` ENUM('pending', 'active', 'overdue', 'settled', 'unsettled', 'negotiated', 'to_be_processed', 'blacklist') NOT NULL DEFAULT 'pending',
    `handling_fee` DECIMAL(10, 2) NOT NULL,
    `total_periods` INTEGER NOT NULL,
    `repaid_periods` INTEGER NOT NULL DEFAULT 0,
    `daily_repayment` INTEGER NOT NULL DEFAULT 0,
    `company_cost` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NOT NULL,
    `updated_at` DATETIME(3) NULL,
    `collector_id` INTEGER NOT NULL,
    `risk_controller_id` INTEGER NOT NULL,
    `apply_times` INTEGER NOT NULL DEFAULT 0,
    `paid_capital` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `status_changed_at` DATETIME(3) NULL,
    `total_fines` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `paid_interest` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `early_settlement_capital` DECIMAL(10, 2) NULL,
    `last_edit_fines` DECIMAL(10, 2) NULL,
    `last_edit_pay_capital` DECIMAL(10, 2) NULL,
    `last_edit_pay_interest` DECIMAL(10, 2) NULL,
    `note` VARCHAR(300) NULL,
    `overdue_count` INTEGER NOT NULL DEFAULT 0,
    `ownership` VARCHAR(2) NULL,

    INDEX `loan_accounts_collector_id_fkey`(`collector_id`),
    INDEX `loan_accounts_risk_controller_id_fkey`(`risk_controller_id`),
    INDEX `loan_accounts_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_account_roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loan_account_id` INTEGER NOT NULL,
    `admin_id` INTEGER NOT NULL,
    `role_type` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `loan_account_roles_admin_id_fkey`(`admin_id`),
    INDEX `loan_account_roles_loan_account_id_idx`(`loan_account_id`),
    UNIQUE INDEX `loan_account_roles_loan_account_id_admin_id_role_type_key`(`loan_account_id`, `admin_id`, `role_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repayment_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loan_id` INTEGER NOT NULL,
    `period` INTEGER NOT NULL,
    `due_start_date` DATE NOT NULL,
    `due_amount` DECIMAL(10, 2) NOT NULL,
    `capital` DECIMAL(10, 2) NULL,
    `interest` DECIMAL(10, 2) NULL,
    `status` ENUM('pending', 'active', 'overdue', 'paid', 'terminated') NOT NULL DEFAULT 'pending',
    `paid_amount` DECIMAL(10, 2) NULL,
    `paid_at` DATETIME(3) NULL,
    `fines` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `operator_admin_id` INTEGER NULL,
    `operator_admin_name` VARCHAR(50) NULL,
    `paid_capital` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `paid_interest` DECIMAL(10, 2) NULL DEFAULT 0.00,

    INDEX `repayment_schedules_loan_id_fkey`(`loan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repayment_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loan_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `paid_amount` DECIMAL(10, 2) NULL,
    `paid_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paid_capital` DECIMAL(10, 2) NULL,
    `paid_fines` DECIMAL(10, 2) NULL,
    `paid_interest` DECIMAL(10, 2) NULL,
    `repayment_schedule_id` INTEGER NULL,
    `actual_collector_id` INTEGER NULL,
    `remark` VARCHAR(10) NULL,

    INDEX `repayment_records_actual_collector_id_fkey`(`actual_collector_id`),
    INDEX `repayment_records_loan_id_fkey`(`loan_id`),
    INDEX `repayment_records_repayment_schedule_id_fkey`(`repayment_schedule_id`),
    INDEX `repayment_records_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `overdue_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `loan_id` INTEGER NOT NULL,
    `schedule_id` INTEGER NOT NULL,
    `collector` VARCHAR(10) NOT NULL,
    `overdue_date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `overdue_records_schedule_id_key`(`schedule_id`),
    INDEX `overdue_records_collector_overdue_date_idx`(`collector`, `overdue_date`),
    INDEX `overdue_records_overdue_date_idx`(`overdue_date`),
    INDEX `overdue_records_user_id_overdue_date_idx`(`user_id`, `overdue_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_statistics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `admin_id` INTEGER NOT NULL,
    `admin_name` VARCHAR(10) NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `total_fines` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_handling_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `active_count` INTEGER NOT NULL DEFAULT 0,
    `last_month_blacklist_count` INTEGER NOT NULL DEFAULT 0,
    `last_month_fines` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `last_month_handling_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `this_month_blacklist_count` INTEGER NOT NULL DEFAULT 0,
    `this_month_fines` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `this_month_handling_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `this_month_negotiated_count` INTEGER NOT NULL DEFAULT 0,
    `this_month_new_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `this_month_settled_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `today_blacklist_count` INTEGER NOT NULL DEFAULT 0,
    `today_collection` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `today_fines` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `today_handling_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `today_negotiated_count` INTEGER NOT NULL DEFAULT 0,
    `today_new_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `today_paid_count` INTEGER NOT NULL DEFAULT 0,
    `today_pending_count` INTEGER NOT NULL DEFAULT 0,
    `today_settled_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `today_unpaid_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_blacklist_count` INTEGER NOT NULL DEFAULT 0,
    `total_in_stock_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_in_stock_count` INTEGER NOT NULL DEFAULT 0,
    `total_negotiated_count` INTEGER NOT NULL DEFAULT 0,
    `total_received_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `yesterday_collection` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `yesterday_overdue_count` INTEGER NOT NULL DEFAULT 0,

    INDEX `daily_statistics_date_idx`(`date`),
    INDEX `daily_statistics_admin_id_idx`(`admin_id`),
    UNIQUE INDEX `daily_statistics_admin_id_date_role_key`(`admin_id`, `date`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collector_daily_loan_balance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `previous_total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `yesterday_loan_total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `today_repaid_total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `today_total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `yesterday_loan_items` JSON NULL,
    `today_repaid_items` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `collector_daily_loan_balance_date_idx`(`date`),
    INDEX `collector_daily_loan_balance_admin_id_idx`(`admin_id`),
    UNIQUE INDEX `collector_daily_loan_balance_admin_id_date_key`(`admin_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collector_asset_management` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `total_handling_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `total_fines` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `reduced_fines` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `reduced_handling_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,

    UNIQUE INDEX `collector_asset_management_admin_id_key`(`admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `risk_controller_asset_management` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `reduced_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `risk_controller_asset_management_admin_id_key`(`admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_field_predictions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `field_name` VARCHAR(50) NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `frequency` INTEGER NOT NULL DEFAULT 1,
    `last_used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `loan_field_predictions_field_name_frequency_idx`(`field_name`, `frequency`),
    INDEX `loan_field_predictions_field_name_value_idx`(`field_name`, `value`),
    UNIQUE INDEX `loan_field_predictions_field_name_value_key`(`field_name`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_reduction_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `asset_type` VARCHAR(50) NOT NULL,
    `field_name` VARCHAR(50) NOT NULL,
    `old_value` DECIMAL(10, 2) NOT NULL,
    `input_value` DECIMAL(10, 2) NOT NULL,
    `new_value` DECIMAL(10, 2) NOT NULL,
    `updated_by_admin_id` INTEGER NULL,
    `updated_by_admin_username` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `asset_reduction_history_admin_id_fkey`(`admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `loan_accounts` ADD CONSTRAINT `loan_accounts_collector_id_fkey` FOREIGN KEY (`collector_id`) REFERENCES `admins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_accounts` ADD CONSTRAINT `loan_accounts_risk_controller_id_fkey` FOREIGN KEY (`risk_controller_id`) REFERENCES `admins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_accounts` ADD CONSTRAINT `loan_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_account_roles` ADD CONSTRAINT `loan_account_roles_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_account_roles` ADD CONSTRAINT `loan_account_roles_loan_account_id_fkey` FOREIGN KEY (`loan_account_id`) REFERENCES `loan_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repayment_schedules` ADD CONSTRAINT `repayment_schedules_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loan_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repayment_records` ADD CONSTRAINT `repayment_records_actual_collector_id_fkey` FOREIGN KEY (`actual_collector_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repayment_records` ADD CONSTRAINT `repayment_records_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loan_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repayment_records` ADD CONSTRAINT `repayment_records_repayment_schedule_id_fkey` FOREIGN KEY (`repayment_schedule_id`) REFERENCES `repayment_schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repayment_records` ADD CONSTRAINT `repayment_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `overdue_records` ADD CONSTRAINT `overdue_records_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `repayment_schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_statistics` ADD CONSTRAINT `daily_statistics_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collector_daily_loan_balance` ADD CONSTRAINT `collector_daily_loan_balance_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collector_asset_management` ADD CONSTRAINT `collector_asset_management_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_controller_asset_management` ADD CONSTRAINT `risk_controller_asset_management_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_reduction_history` ADD CONSTRAINT `asset_reduction_history_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

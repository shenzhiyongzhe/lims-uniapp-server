-- AlterTable
ALTER TABLE `loan_accounts` ADD COLUMN `payer_name` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `loan_field_predictions` MODIFY `value` VARCHAR(50) NOT NULL;

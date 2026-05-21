-- 历史库中 value 仍为 DECIMAL，与 Prisma String 不一致，统一改为 VARCHAR(50)
ALTER TABLE `loan_field_predictions` MODIFY `value` VARCHAR(50) NOT NULL;

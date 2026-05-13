-- 在已有库上执行一次（db push 若未自动建表时）。新建库可省略。
--
-- 若 db push 仍报 loan_accounts.id 外键无法改列：请保持 schema 中 LoanAccount.id 的
-- @db.VarChar(长度) 与当前 MySQL 列定义一致（Prisma 默认多为 191），勿改为更短。
CREATE TABLE IF NOT EXISTS `loan_account_sequence` (
  `id` INT NOT NULL PRIMARY KEY,
  `next_num` INT NOT NULL DEFAULT 0
) DEFAULT CHARSET = utf8mb4;

-- 若已有 loan_accounts 且 id 为纯数字，将序号对齐到当前最大值，避免新 id 冲突
INSERT INTO `loan_account_sequence` (`id`, `next_num`)
SELECT
  1,
  IFNULL(
    (SELECT MAX(CAST(`id` AS UNSIGNED)) FROM `loan_accounts` WHERE `id` REGEXP '^[0-9]+$'),
    0
  )
ON DUPLICATE KEY UPDATE
  `next_num` = GREATEST(
    `loan_account_sequence`.`next_num`,
    IFNULL(
      (SELECT MAX(CAST(`id` AS UNSIGNED)) FROM `loan_accounts` WHERE `id` REGEXP '^[0-9]+$'),
      0
    )
  );

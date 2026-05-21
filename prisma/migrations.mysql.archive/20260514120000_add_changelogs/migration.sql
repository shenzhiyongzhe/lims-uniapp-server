-- CreateTable
CREATE TABLE `changelogs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `released_at` DATE NOT NULL,
    `version` VARCHAR(32) NOT NULL,
    `content` VARCHAR(2000) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `changelogs` (`released_at`, `version`, `content`)
VALUES (CURDATE(), '1.0.0', '新增更新日志与系统说明。');

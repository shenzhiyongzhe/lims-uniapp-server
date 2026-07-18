-- CreateTable
CREATE TABLE "archives" (
    "id" SERIAL NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "phone" VARCHAR(32) NOT NULL DEFAULT '',
    "address" VARCHAR(256) NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "job" VARCHAR(128) NOT NULL DEFAULT '',
    "income" VARCHAR(128) NOT NULL DEFAULT '',
    "date" DATE,
    "account" VARCHAR(128) NOT NULL DEFAULT '',
    "password" VARCHAR(128) NOT NULL DEFAULT '',
    "situation" TEXT NOT NULL DEFAULT '',
    "detail" VARCHAR(2000) NOT NULL DEFAULT '',
    "photos" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "archives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "archives_creator_id_idx" ON "archives"("creator_id");

-- CreateIndex
CREATE INDEX "archives_name_idx" ON "archives"("name");

-- AddForeignKey
ALTER TABLE "archives" ADD CONSTRAINT "archives_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "staffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

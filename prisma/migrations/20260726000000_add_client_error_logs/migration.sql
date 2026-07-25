-- CreateTable
CREATE TABLE "client_error_logs" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER,
    "level" VARCHAR(20) NOT NULL DEFAULT 'error',
    "type" VARCHAR(50) NOT NULL DEFAULT 'js',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "page_route" VARCHAR(255),
    "device_info" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_error_logs_created_at_idx" ON "client_error_logs"("created_at");

-- CreateIndex
CREATE INDEX "client_error_logs_staff_id_idx" ON "client_error_logs"("staff_id");

-- CreateIndex
CREATE INDEX "client_error_logs_type_idx" ON "client_error_logs"("type");

-- AddForeignKey
ALTER TABLE "client_error_logs" ADD CONSTRAINT "client_error_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

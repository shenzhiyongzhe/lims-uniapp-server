-- Reset all table primary key sequences in PostgreSQL to match the maximum ID in each table
-- This prevents "Unique constraint failed on the fields: (id)" / "duplicate key value violates unique constraint" errors

SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);
SELECT setval('admins_id_seq', COALESCE((SELECT MAX(id) FROM admins), 0) + 1, false);
SELECT setval('loan_accounts_id_seq', COALESCE((SELECT MAX(id) FROM loan_accounts), 0) + 1, false);
SELECT setval('loan_account_roles_id_seq', COALESCE((SELECT MAX(id) FROM loan_account_roles), 0) + 1, false);
SELECT setval('repayment_schedules_id_seq', COALESCE((SELECT MAX(id) FROM repayment_schedules), 0) + 1, false);
SELECT setval('repayment_schedule_operation_logs_id_seq', COALESCE((SELECT MAX(id) FROM repayment_schedule_operation_logs), 0) + 1, false);
SELECT setval('loan_account_operation_logs_id_seq', COALESCE((SELECT MAX(id) FROM loan_account_operation_logs), 0) + 1, false);
SELECT setval('repayment_records_id_seq', COALESCE((SELECT MAX(id) FROM repayment_records), 0) + 1, false);
SELECT setval('overdue_records_id_seq', COALESCE((SELECT MAX(id) FROM overdue_records), 0) + 1, false);
SELECT setval('daily_statistics_id_seq', COALESCE((SELECT MAX(id) FROM daily_statistics), 0) + 1, false);
SELECT setval('collector_daily_loan_balance_id_seq', COALESCE((SELECT MAX(id) FROM collector_daily_loan_balance), 0) + 1, false);
SELECT setval('collector_asset_management_id_seq', COALESCE((SELECT MAX(id) FROM collector_asset_management), 0) + 1, false);
SELECT setval('risk_controller_asset_management_id_seq', COALESCE((SELECT MAX(id) FROM risk_controller_asset_management), 0) + 1, false);
SELECT setval('loan_field_predictions_id_seq', COALESCE((SELECT MAX(id) FROM loan_field_predictions), 0) + 1, false);
SELECT setval('asset_reduction_history_id_seq', COALESCE((SELECT MAX(id) FROM asset_reduction_history), 0) + 1, false);
SELECT setval('changelogs_id_seq', COALESCE((SELECT MAX(id) FROM changelogs), 0) + 1, false);

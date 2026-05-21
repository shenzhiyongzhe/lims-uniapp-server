-- Run BEFORE add-constraints-after-import.sql.
-- Any row returned means FK creation will fail until data is fixed.

-- loan_accounts
SELECT 'loan_accounts.user_id' AS check_name, la.id AS row_id, la.user_id AS bad_fk
FROM loan_accounts la
LEFT JOIN users u ON u.id = la.user_id
WHERE u.id IS NULL
LIMIT 20;

SELECT 'loan_accounts.collector_id', la.id, la.collector_id
FROM loan_accounts la
LEFT JOIN admins a ON a.id = la.collector_id
WHERE a.id IS NULL
LIMIT 20;

SELECT 'loan_accounts.risk_controller_id', la.id, la.risk_controller_id
FROM loan_accounts la
LEFT JOIN admins a ON a.id = la.risk_controller_id
WHERE a.id IS NULL
LIMIT 20;

-- loan_account_roles
SELECT 'loan_account_roles.loan_account_id', lar.id, lar.loan_account_id
FROM loan_account_roles lar
LEFT JOIN loan_accounts la ON la.id = lar.loan_account_id
WHERE la.id IS NULL
LIMIT 20;

SELECT 'loan_account_roles.admin_id', lar.id, lar.admin_id
FROM loan_account_roles lar
LEFT JOIN admins a ON a.id = lar.admin_id
WHERE a.id IS NULL
LIMIT 20;

-- repayment_schedules
SELECT 'repayment_schedules.loan_id', rs.id, rs.loan_id
FROM repayment_schedules rs
LEFT JOIN loan_accounts la ON la.id = rs.loan_id
WHERE la.id IS NULL
LIMIT 20;

-- repayment_schedule_operation_logs
SELECT 'repayment_schedule_operation_logs.schedule_id', l.id, l.schedule_id
FROM repayment_schedule_operation_logs l
LEFT JOIN repayment_schedules rs ON rs.id = l.schedule_id
WHERE rs.id IS NULL
LIMIT 20;

SELECT 'repayment_schedule_operation_logs.operator_admin_id', l.id, l.operator_admin_id
FROM repayment_schedule_operation_logs l
LEFT JOIN admins a ON a.id = l.operator_admin_id
WHERE l.operator_admin_id IS NOT NULL AND a.id IS NULL
LIMIT 20;

-- repayment_records
SELECT 'repayment_records.loan_id', rr.id, rr.loan_id
FROM repayment_records rr
LEFT JOIN loan_accounts la ON la.id = rr.loan_id
WHERE la.id IS NULL
LIMIT 20;

SELECT 'repayment_records.user_id', rr.id, rr.user_id
FROM repayment_records rr
LEFT JOIN users u ON u.id = rr.user_id
WHERE u.id IS NULL
LIMIT 20;

SELECT 'repayment_records.repayment_schedule_id', rr.id, rr.repayment_schedule_id
FROM repayment_records rr
LEFT JOIN repayment_schedules rs ON rs.id = rr.repayment_schedule_id
WHERE rr.repayment_schedule_id IS NOT NULL AND rs.id IS NULL
LIMIT 20;

SELECT 'repayment_records.actual_collector_id', rr.id, rr.actual_collector_id
FROM repayment_records rr
LEFT JOIN admins a ON a.id = rr.actual_collector_id
WHERE rr.actual_collector_id IS NOT NULL AND a.id IS NULL
LIMIT 20;

-- overdue_records
SELECT 'overdue_records.schedule_id', o.id, o.schedule_id
FROM overdue_records o
LEFT JOIN repayment_schedules rs ON rs.id = o.schedule_id
WHERE rs.id IS NULL
LIMIT 20;

-- daily_statistics / collector_* / asset_reduction_history
SELECT 'daily_statistics.admin_id', d.id, d.admin_id
FROM daily_statistics d
LEFT JOIN admins a ON a.id = d.admin_id
WHERE a.id IS NULL
LIMIT 20;

SELECT 'collector_daily_loan_balance.admin_id', c.id, c.admin_id
FROM collector_daily_loan_balance c
LEFT JOIN admins a ON a.id = c.admin_id
WHERE a.id IS NULL
LIMIT 20;

SELECT 'collector_asset_management.admin_id', c.id, c.admin_id
FROM collector_asset_management c
LEFT JOIN admins a ON a.id = c.admin_id
WHERE a.id IS NULL
LIMIT 20;

SELECT 'risk_controller_asset_management.admin_id', r.id, r.admin_id
FROM risk_controller_asset_management r
LEFT JOIN admins a ON a.id = r.admin_id
WHERE a.id IS NULL
LIMIT 20;

SELECT 'asset_reduction_history.admin_id', h.id, h.admin_id
FROM asset_reduction_history h
LEFT JOIN admins a ON a.id = h.admin_id
WHERE a.id IS NULL
LIMIT 20;

-- duplicate unique keys (will fail UNIQUE INDEX creation)
SELECT 'duplicate admins.openid', openid, COUNT(*)
FROM admins
WHERE openid IS NOT NULL
GROUP BY openid
HAVING COUNT(*) > 1;

SELECT 'duplicate loan_account_roles', loan_account_id, admin_id, role_type, COUNT(*)
FROM loan_account_roles
GROUP BY loan_account_id, admin_id, role_type
HAVING COUNT(*) > 1;

SELECT 'duplicate overdue_records.schedule_id', schedule_id, COUNT(*)
FROM overdue_records
GROUP BY schedule_id
HAVING COUNT(*) > 1;

SELECT 'duplicate daily_statistics', admin_id, date, role, COUNT(*)
FROM daily_statistics
GROUP BY admin_id, date, role
HAVING COUNT(*) > 1;

SELECT 'duplicate collector_daily_loan_balance', admin_id, date, COUNT(*)
FROM collector_daily_loan_balance
GROUP BY admin_id, date
HAVING COUNT(*) > 1;

SELECT 'duplicate collector_asset_management.admin_id', admin_id, COUNT(*)
FROM collector_asset_management
GROUP BY admin_id
HAVING COUNT(*) > 1;

SELECT 'duplicate risk_controller_asset_management.admin_id', admin_id, COUNT(*)
FROM risk_controller_asset_management
GROUP BY admin_id
HAVING COUNT(*) > 1;

SELECT 'duplicate loan_field_predictions', field_name, value, COUNT(*)
FROM loan_field_predictions
GROUP BY field_name, value
HAVING COUNT(*) > 1;

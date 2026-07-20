-- Up Migration
-- The migration ledger is the only persistent structure introduced at this stage.
-- Domain-owned tables are added with the modules that define their contracts.
SELECT current_database();

-- Down Migration
SELECT current_database();

-- =========================
-- seed.sql (PostgreSQL) - MATCHES YOUR CSV HEADERS
-- Run:
--   psql -h csce-315-db.engr.tamu.edu -U team_26 -d team_26_db -f seed.sql
-- =========================


-- -------------------------
-- LOAD CSVs
-- -------------------------
-- Run psql from the folder containing the CSVs so relative paths work.

\copy employees(id, permission, actions, changes) FROM 'employees.csv' WITH (FORMAT csv, HEADER true);

\copy ingredients(id, name, unit, availability) FROM 'ingredients.csv' WITH (FORMAT csv, HEADER true);

\copy inventory(id, ingredient_id, quantity, threshold) FROM 'inventory.csv' WITH (FORMAT csv, HEADER true);

\copy menu_items(id, name, price, availability) FROM 'menu_items.csv' WITH (FORMAT csv, HEADER true);

\copy menu_item_ingredients(id, menu_item_id, ingredient_id) FROM 'menu_item_ingredients.csv' WITH (FORMAT csv, HEADER true);

\copy orders(id, order_time, total_amount, cashier) FROM 'orders.csv' WITH (FORMAT csv, HEADER true);

\copy order_items(id, order_id, quantity, price_charged, menu_item_id) FROM 'order_items.csv' WITH (FORMAT csv, HEADER true);

-- -------------------------
-- SANITY CHECKS
-- -------------------------
SELECT 'employees' AS table_name, COUNT(*) FROM employees
UNION ALL SELECT 'ingredients', COUNT(*) FROM ingredients
UNION ALL SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL SELECT 'menu_items', COUNT(*) FROM menu_items
UNION ALL SELECT 'menu_item_ingredients', COUNT(*) FROM menu_item_ingredients
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
ORDER BY table_name;
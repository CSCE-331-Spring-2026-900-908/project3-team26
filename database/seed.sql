\set ON_ERROR_STOP on

\copy employees(id, permission, actions, changes) FROM 'database/csv/employees.csv' WITH (FORMAT csv, HEADER true);
\copy ingredients(id, name, unit, availability) FROM 'database/csv/ingredients.csv' WITH (FORMAT csv, HEADER true);
\copy inventory(id, ingredient_id, quantity, threshold) FROM 'database/csv/inventory.csv' WITH (FORMAT csv, HEADER true);
\copy menu_items(id, name, price, availability) FROM 'database/csv/menu_items.csv' WITH (FORMAT csv, HEADER true);
\copy menu_item_ingredients(id, menu_item_id, ingredient_id) FROM 'database/csv/menu_item_ingredients.csv' WITH (FORMAT csv, HEADER true);
\copy orders(id, order_time, total_amount, cashier) FROM 'database/csv/orders.csv' WITH (FORMAT csv, HEADER true);
\copy order_items(id, order_id, quantity, price_charged, menu_item_id) FROM 'database/csv/order_items.csv' WITH (FORMAT csv, HEADER true);

UPDATE orders
SET order_source = 'cashier'
WHERE order_source IS NULL OR order_source = '';

INSERT INTO order_payments (order_id, business_date, method, amount)
SELECT
  id,
  order_time::date,
  CASE WHEN id % 4 = 0 THEN 'CARD' ELSE 'CASH' END,
  total_amount
FROM orders
ON CONFLICT (order_id) DO NOTHING;

SELECT 'employees' AS table_name, COUNT(*) FROM employees
UNION ALL SELECT 'ingredients', COUNT(*) FROM ingredients
UNION ALL SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL SELECT 'menu_items', COUNT(*) FROM menu_items
UNION ALL SELECT 'menu_item_ingredients', COUNT(*) FROM menu_item_ingredients
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
ORDER BY table_name;

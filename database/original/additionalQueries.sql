 /* 
 Diagram naming convention:
     ORDER1(orderID, time, total, cashier)
     EMPLOYEE(employeeID, permission, actions, changes)
     ORDERITEM(orderItemID, orderID, menuItem, quantity, priceCharged)
     MENUITEM(menuItemID, name, price, availability)
     INGREDIENT(ingredientID, name, unit, availability)
     INVENTORY(inventoryID, ingredientID, quantity, threshold)
*/


\echo '-- 1. Validates alpha parameter: Number of weeks of sales history'
\echo '-- Shows count of orders and total sales grouped by week'
\echo '-- Should display alpha weeks of data (26/39/52/65 depending on team size)'

SELECT
    DATE_TRUNC('week', orders.order_time) AS week_start,
    COUNT(orders.id) AS number_of_orders,
    SUM(order_totals.order_total) AS weekly_total_sales
FROM orders
JOIN (
    SELECT
    orders.id AS order_id,
    SUM(order_items.quantity * order_items.price_charged) AS order_total
    FROM orders
    JOIN order_items
    ON order_items.order_id = orders.id
    GROUP BY orders.id
) AS order_totals
ON orders.id = order_totals.order_id
GROUP BY DATE_TRUNC('week', orders.order_time)
ORDER BY week_start;


\echo '-- 2. Validates alpha parameter: Date range verification'
\echo '-- Confirms that sales data spans from approximately one year ago to today'
\echo '-- Should show data from ~Feb 2025 to ~Feb 2026 with week count matching alpha'

SELECT
    MIN(orders.order_time) AS earliest_order_date,
    MAX(orders.order_time) AS latest_order_date,
    EXTRACT(DAY FROM (MAX(orders.order_time) - MIN(orders.order_time))) AS days_between,
    ROUND(EXTRACT(DAY FROM (MAX(orders.order_time) - MIN(orders.order_time))) / 7.0, 1) AS weeks_of_data
FROM orders;


\echo '-- 3. Validates beta parameter: Total sales amount'
\echo '-- Calculates total sales across all orders'
\echo '-- Should show approximately beta amount (~$500K/~$750K/~$1M/~$1.25M depending on team size)'

SELECT
    SUM(order_totals.order_total) AS total_sales_all_time,
    COUNT(orders.id) AS total_number_of_orders,
    AVG(order_totals.order_total) AS average_order_value,
    MIN(orders.order_time) AS earliest_order,
    MAX(orders.order_time) AS latest_order
FROM orders
JOIN (
    SELECT
    orders.id AS order_id,
    SUM(order_items.quantity * order_items.price_charged) AS order_total
    FROM orders
    JOIN order_items
    ON order_items.order_id = orders.id
    GROUP BY orders.id
) AS order_totals
ON orders.id = order_totals.order_id;


\echo '-- 4. Validates phi parameter: Number of peak sales days'
\echo '-- Identifies the top sales days to verify peak periods (semester start, game days, holidays)'
\echo '-- Top φ days (1/2/3/4 depending on team size) should show significantly higher sales'

SELECT
    DATE(orders.order_time) AS sales_date,
    COUNT(orders.id) AS number_of_orders,
    SUM(order_totals.order_total) AS daily_total_sales
FROM orders
JOIN (
    SELECT
    orders.id AS order_id,
    SUM(order_items.quantity * order_items.price_charged) AS order_total
    FROM orders
    JOIN order_items
    ON order_items.order_id = orders.id
    GROUP BY orders.id
) AS order_totals
ON orders.id = order_totals.order_id
GROUP BY DATE(orders.order_time)
ORDER BY daily_total_sales DESC
FETCH FIRST 10 ROWS ONLY;


\echo '-- 5. Validates delta parameter: Total number of menu items in database'
\echo '-- Verifies the total number of menu items created (not just sold items)'
\echo '-- Should show at least delta menu items (12/16/20/24 depending on team size)'

SELECT
    COUNT(*) AS total_menu_items_in_database,
    COUNT(CASE WHEN availability = TRUE THEN 1 END) AS available_menu_items,
    COUNT(CASE WHEN availability = FALSE THEN 1 END) AS unavailable_menu_items
FROM menu_items;


\echo '-- 6. Validates delta parameter: Distinct menu items that were sold'
\echo '-- Shows how many different menu items have been sold at least once'
\echo '-- Most or all of the delta menu items should appear in sales history'

SELECT
    COUNT(DISTINCT order_items.menu_item_id) AS number_of_distinct_menu_items_sold
FROM order_items;


\echo '-- 7. States which menu items are ordered the most by quantity (will tell us most popular items)'
\echo '-- Custom query to show which menu items to prioritize for profit'

SELECT
    menu_items.id,
    menu_items.name AS menu_item_name,
    SUM(order_items.quantity) AS total_units_sold
FROM order_items
JOIN menu_items
ON order_items.menu_item_id = menu_items.id
GROUP BY menu_items.id, menu_items.name
ORDER BY total_units_sold DESC
FETCH FIRST 10 ROWS ONLY;


\echo '-- 8. States each cashiers average order sizes (to compare who sells more items, not necessarily sales)'
\echo '-- Used to determine effective cashiers for recognition and wage purposes'
\echo '-- Also can be used to detemine correspondance between shift time and order sizes'

SELECT
    employees.id AS cashier_employee_id,
    employees.permission AS cashier_permission,
    COUNT(order_totals.order_id) AS number_of_orders,
    AVG(order_totals.order_total) AS average_order_total
FROM (
    SELECT
    orders.id AS order_id,
    orders.cashier,
    SUM(order_items.quantity * order_items.price_charged) AS order_total
    FROM orders
    JOIN order_items
    ON order_items.order_id = orders.id
    GROUP BY orders.id, orders.cashier
) AS order_totals
JOIN employees
ON order_totals.cashier = employees.id
GROUP BY employees.id, employees.permission
ORDER BY average_order_total DESC;


\echo '-- 9. Tells the total sales that each individual cashier has (who earned the most money)'
\echo '-- Used to determine effective cashiers for recognition and wage purposes'
\echo '-- Can be used to set shift times to allocate productive cashiers to peak hours'

SELECT
    order_totals.cashier AS cashier_employee_id,
    SUM(order_totals.order_total) AS total_sales_handled
FROM (
    SELECT
    orders.id AS order_id,
    orders.cashier,
    SUM(order_items.quantity * order_items.price_charged) AS order_total
    FROM orders
    JOIN order_items
    ON order_items.order_id = orders.id
    GROUP BY orders.id, orders.cashier
) AS order_totals
GROUP BY order_totals.cashier
ORDER BY total_sales_handled DESC;
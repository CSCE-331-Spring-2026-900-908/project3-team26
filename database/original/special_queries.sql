-- special_queries.sql
-- need 5 special queries total
-- Run from psql:
--   inside psql: \i special_queries.sql
\pset pager off
\pset columns 200



\echo '-------------------------------------'
\echo 'Special Query 1 "Weekly Sales History'
\echo '-------------------------------------'
-- select count of orders grouped by week
-- given a specific week, how many orders were placed?
SELECT
  DATE_TRUNC('week', order_time)::date AS week_start,
  COUNT(*) AS order_count
FROM orders
GROUP BY week_start
ORDER BY week_start DESC
LIMIT 10;



\echo '-------------------------------------'
\echo  'Special Query 2 "Peak Sales Day'
\echo '-------------------------------------'
-- select top 10 sums of order total grouped by day in descending order by order total
-- given a specific day, what was the sum of the top 10 order totals?
SELECT day, SUM(total_amount) AS sum_top10_totals
FROM (
  SELECT order_time::date AS day, total_amount,
         ROW_NUMBER() OVER (PARTITION BY order_time::date ORDER BY total_amount DESC) AS rn
  FROM orders
) t
WHERE rn <= 10
GROUP BY day
ORDER BY sum_top10_totals DESC
LIMIT 10;



\echo '-------------------------------------'
\echo 'Special Query 3 "Realistic Sales History'
\echo '-------------------------------------'
-- select count of orders, sum of order total grouped by hour
-- given a specific hour of the day, how many orders were placed and what was the total sum of the orders?
SELECT
  EXTRACT(HOUR FROM order_time)::int AS hour_of_day,
  COUNT(*) AS order_count,
  SUM(total_amount) AS total_sales
FROM orders
GROUP BY hour_of_day
ORDER BY hour_of_day;



\echo '-------------------------------------'
\echo 'Special Query 4 "Menu Item Inventory'
\echo '-------------------------------------'
-- select count of inventory items from inventory and menu grouped by menu item
-- given a specific menu item, how many items from the inventory does that menu item use?
SELECT
  m.id,
  m.name AS menu_item,
  COUNT(*) AS inventory_items_used
FROM menu_item_ingredients mi
JOIN menu_items m ON m.id = mi.menu_item_id
GROUP BY m.id, m.name
ORDER BY inventory_items_used DESC, m.name;



\echo '-------------------------------------'
\echo  'Special Query 5 "Best of the Worst'
\echo '-------------------------------------'
-- select bottom sum of order total, top count of menu items by day grouped by week
-- given a specific week, what day had the lowest sales, what were the sales numbers, and what was the top seller that day?
WITH day_sales AS (
  SELECT
    DATE_TRUNC('week', o.order_time)::date AS week_start,
    o.order_time::date AS day,
    SUM(o.total_amount) AS day_sales
  FROM orders o
  GROUP BY 1, 2
),
worst_day AS (
  SELECT
    week_start,
    day,
    day_sales,
    ROW_NUMBER() OVER (
      PARTITION BY week_start
      ORDER BY day_sales ASC, day ASC
    ) AS rn
  FROM day_sales
),
day_top_item AS (
  SELECT
    o.order_time::date AS day,
    m.name AS top_item,
    SUM(oi.quantity)::int AS qty_sold,
    ROW_NUMBER() OVER (
      PARTITION BY o.order_time::date
      ORDER BY SUM(oi.quantity) DESC, m.name
    ) AS rn
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN menu_items m ON m.id = oi.menu_item_id
  GROUP BY 1, 2
)
SELECT
  w.week_start,
  w.day AS lowest_sales_day,
  w.day_sales AS lowest_day_sales,
  d.top_item AS top_seller_on_lowest_day,
  d.qty_sold AS top_seller_qty
FROM worst_day w
LEFT JOIN day_top_item d
  ON d.day = w.day AND d.rn = 1
WHERE w.rn = 1
ORDER BY w.week_start DESC
LIMIT 10;
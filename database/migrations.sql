\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'cashier';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_order_source_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_order_source_check
      CHECK (order_source IN ('cashier', 'kiosk'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS order_payments (
  order_id INT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  method TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_voids (
  order_id INT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  voided_at TIMESTAMP NOT NULL DEFAULT NOW(),
  manager_id INT REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS report_daily_totals (
  business_date DATE PRIMARY KEY,
  sales NUMERIC(12,2) NOT NULL DEFAULT 0,
  returns_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  returns_count INT NOT NULL DEFAULT 0,
  voids INT NOT NULL DEFAULT 0,
  discards INT NOT NULL DEFAULT 0,
  cash_payments NUMERIC(12,2) NOT NULL DEFAULT 0,
  card_payments NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_payments NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  discounts NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_charges NUMERIC(12,2) NOT NULL DEFAULT 0,
  z_generated BOOLEAN NOT NULL DEFAULT FALSE,
  z_generated_at TIMESTAMP,
  z_signature TEXT
);

CREATE TABLE IF NOT EXISTS z_report_archive (
  id SERIAL PRIMARY KEY,
  business_date DATE NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  signature TEXT NOT NULL,
  sales NUMERIC(12,2) NOT NULL,
  returns_amount NUMERIC(12,2) NOT NULL,
  returns_count INT NOT NULL,
  voids INT NOT NULL,
  discards INT NOT NULL,
  cash_payments NUMERIC(12,2) NOT NULL,
  card_payments NUMERIC(12,2) NOT NULL,
  other_payments NUMERIC(12,2) NOT NULL,
  tax NUMERIC(12,2) NOT NULL,
  total_cash NUMERIC(12,2) NOT NULL,
  discounts NUMERIC(12,2) NOT NULL,
  service_charges NUMERIC(12,2) NOT NULL
);

UPDATE orders
SET order_source = 'cashier'
WHERE order_source IS NULL OR order_source = '';

INSERT INTO ingredients (id, name, unit, availability)
VALUES
  (16, 'Nuts', 'oz', TRUE),
  (17, 'Coffee', 'oz', TRUE),
  (18, 'Coconut Creamer', 'oz', TRUE),
  (19, 'Lychee Popping Boba', 'oz', TRUE),
  (20, 'Mango Popping Boba', 'oz', TRUE),
  (21, 'Strawberry Popping Boba', 'oz', TRUE),
  (22, 'Crystal Boba', 'oz', TRUE),
  (23, 'Aloe Vera', 'oz', TRUE),
  (24, 'Egg Pudding', 'oz', TRUE),
  (25, 'Red Bean', 'oz', TRUE),
  (26, 'Grass Jelly', 'oz', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO inventory (id, ingredient_id, quantity, threshold)
VALUES
  (16, 16, 165, 18),
  (17, 17, 220, 20),
  (18, 18, 245, 22),
  (19, 19, 220, 25),
  (20, 20, 220, 25),
  (21, 21, 220, 25),
  (22, 22, 180, 20),
  (23, 23, 180, 20),
  (24, 24, 180, 20),
  (25, 25, 160, 18),
  (26, 26, 180, 20)
ON CONFLICT (id) DO NOTHING;

INSERT INTO menu_items (id, name, price, availability)
VALUES
  (17, 'Taro Coconut Latte', 5.29, TRUE),
  (18, 'Brown Sugar Coconut Latte', 5.39, TRUE),
  (19, 'Coconut Lychee Cooler', 5.19, TRUE),
  (20, 'Strawberry Lychee Slush', 5.29, TRUE),
  (21, 'Jasmine Coconut Milk Tea', 5.19, TRUE),
  (22, 'Oolong Coconut Milk Tea', 5.19, TRUE),
  (23, 'Taro Cream Latte', 5.29, TRUE),
  (24, 'Brown Sugar Cream Latte', 5.39, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO menu_item_ingredients (id, menu_item_id, ingredient_id)
VALUES
  (98, 4, 16),
  (99, 5, 16),
  (100, 15, 17),
  (101, 17, 8),
  (102, 17, 12),
  (103, 17, 13),
  (104, 17, 14),
  (105, 17, 15),
  (106, 17, 18),
  (107, 18, 5),
  (108, 18, 6),
  (109, 18, 12),
  (110, 18, 13),
  (111, 18, 14),
  (112, 18, 15),
  (113, 18, 18),
  (114, 19, 11),
  (115, 19, 12),
  (116, 19, 13),
  (117, 19, 14),
  (118, 19, 15),
  (119, 19, 18),
  (120, 20, 10),
  (121, 20, 11),
  (122, 20, 12),
  (123, 20, 13),
  (124, 20, 14),
  (125, 20, 15),
  (126, 21, 2),
  (127, 21, 12),
  (128, 21, 13),
  (129, 21, 14),
  (130, 21, 15),
  (131, 21, 18),
  (132, 22, 3),
  (133, 22, 12),
  (134, 22, 13),
  (135, 22, 14),
  (136, 22, 15),
  (137, 22, 18),
  (138, 23, 4),
  (139, 23, 8),
  (140, 23, 12),
  (141, 23, 13),
  (142, 23, 14),
  (143, 23, 15),
  (144, 24, 4),
  (145, 24, 5),
  (146, 24, 6),
  (147, 24, 12),
  (148, 24, 13),
  (149, 24, 14),
  (150, 24, 15)
ON CONFLICT (id) DO NOTHING;

COMMIT;

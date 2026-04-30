-- migrations.sql: optional schema upgrades used by the API when extra reporting/payment tables exist.
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
  (26, 'Grass Jelly', 'oz', TRUE),
  (27, 'Thai Tea', 'oz', TRUE),
  (28, 'Honeydew Syrup', 'oz', TRUE),
  (29, 'Passionfruit Syrup', 'oz', TRUE),
  (30, 'Peach Syrup', 'oz', TRUE),
  (31, 'Wintermelon Syrup', 'oz', TRUE),
  (32, 'Jasmine Tea', 'oz', TRUE),
  (33, 'Cream', 'oz', TRUE)
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
  (26, 26, 180, 20),
  (27, 27, 240, 22),
  (28, 28, 220, 20),
  (29, 29, 220, 20),
  (30, 30, 220, 20),
  (31, 31, 220, 20),
  (32, 32, 240, 22),
  (33, 33, 180, 18)
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

DELETE FROM menu_item_ingredients
WHERE menu_item_id BETWEEN 1 AND 24;

INSERT INTO menu_item_ingredients (id, menu_item_id, ingredient_id)
VALUES
  (1, 1, 1),
  (2, 1, 4),
  (3, 1, 6),
  (4, 1, 12),
  (5, 1, 13),
  (6, 1, 14),
  (7, 1, 15),
  (8, 2, 1),
  (9, 2, 4),
  (10, 2, 5),
  (11, 2, 6),
  (12, 2, 12),
  (13, 2, 13),
  (14, 2, 14),
  (15, 2, 15),
  (16, 3, 27),
  (17, 3, 4),
  (18, 3, 12),
  (19, 3, 13),
  (20, 3, 14),
  (21, 3, 15),
  (22, 4, 1),
  (23, 4, 4),
  (24, 4, 8),
  (25, 4, 6),
  (26, 4, 12),
  (27, 4, 13),
  (28, 4, 14),
  (29, 4, 15),
  (30, 5, 7),
  (31, 5, 4),
  (32, 5, 12),
  (33, 5, 13),
  (34, 5, 14),
  (35, 5, 15),
  (36, 6, 32),
  (37, 6, 2),
  (38, 6, 4),
  (39, 6, 12),
  (40, 6, 13),
  (41, 6, 14),
  (42, 6, 15),
  (43, 7, 3),
  (44, 7, 4),
  (45, 7, 12),
  (46, 7, 13),
  (47, 7, 14),
  (48, 7, 15),
  (49, 8, 2),
  (50, 8, 4),
  (51, 8, 28),
  (52, 8, 12),
  (53, 8, 13),
  (54, 8, 14),
  (55, 8, 15),
  (56, 9, 2),
  (57, 9, 9),
  (58, 9, 12),
  (59, 9, 13),
  (60, 9, 14),
  (61, 9, 15),
  (62, 10, 2),
  (63, 10, 10),
  (64, 10, 12),
  (65, 10, 13),
  (66, 10, 14),
  (67, 10, 15),
  (68, 11, 1),
  (69, 11, 29),
  (70, 11, 12),
  (71, 11, 13),
  (72, 11, 14),
  (73, 11, 15),
  (74, 12, 3),
  (75, 12, 30),
  (76, 12, 12),
  (77, 12, 13),
  (78, 12, 14),
  (79, 12, 15),
  (80, 13, 11),
  (81, 13, 12),
  (82, 13, 13),
  (83, 13, 14),
  (84, 13, 15),
  (85, 14, 9),
  (86, 14, 12),
  (87, 14, 13),
  (88, 14, 14),
  (89, 14, 15),
  (90, 15, 17),
  (91, 15, 4),
  (92, 15, 6),
  (93, 15, 12),
  (94, 15, 13),
  (95, 15, 14),
  (96, 15, 15),
  (97, 16, 2),
  (98, 16, 4),
  (99, 16, 31),
  (100, 16, 12),
  (101, 16, 13),
  (102, 16, 14),
  (103, 16, 15),
  (104, 17, 8),
  (105, 17, 18),
  (106, 17, 12),
  (107, 17, 13),
  (108, 17, 14),
  (109, 17, 15),
  (110, 18, 5),
  (111, 18, 6),
  (112, 18, 18),
  (113, 18, 12),
  (114, 18, 13),
  (115, 18, 14),
  (116, 18, 15),
  (117, 19, 11),
  (118, 19, 18),
  (119, 19, 19),
  (120, 19, 12),
  (121, 19, 13),
  (122, 19, 14),
  (123, 19, 15),
  (124, 20, 10),
  (125, 20, 11),
  (126, 20, 21),
  (127, 20, 12),
  (128, 20, 13),
  (129, 20, 14),
  (130, 20, 15),
  (131, 21, 32),
  (132, 21, 2),
  (133, 21, 4),
  (134, 21, 18),
  (135, 21, 12),
  (136, 21, 13),
  (137, 21, 14),
  (138, 21, 15),
  (139, 22, 3),
  (140, 22, 4),
  (141, 22, 18),
  (142, 22, 12),
  (143, 22, 13),
  (144, 22, 14),
  (145, 22, 15),
  (146, 23, 4),
  (147, 23, 8),
  (148, 23, 33),
  (149, 23, 12),
  (150, 23, 13),
  (151, 23, 14),
  (152, 23, 15),
  (153, 24, 4),
  (154, 24, 5),
  (155, 24, 6),
  (156, 24, 33),
  (157, 24, 12),
  (158, 24, 13),
  (159, 24, 14),
  (160, 24, 15)
ON CONFLICT (id) DO UPDATE
SET menu_item_id = EXCLUDED.menu_item_id,
    ingredient_id = EXCLUDED.ingredient_id;

COMMIT;

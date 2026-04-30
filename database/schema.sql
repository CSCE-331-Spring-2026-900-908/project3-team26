-- schema.sql: base PostgreSQL schema for the Bubble Tea POS database.
\set ON_ERROR_STOP on

BEGIN;

DROP TABLE IF EXISTS z_report_archive CASCADE;
DROP TABLE IF EXISTS report_daily_totals CASCADE;
DROP TABLE IF EXISTS order_voids CASCADE;
DROP TABLE IF EXISTS order_payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_item_ingredients CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

CREATE TABLE employees (
  id INT PRIMARY KEY,
  permission TEXT,
  actions TEXT,
  changes TEXT
);

CREATE TABLE ingredients (
  id INT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT,
  availability BOOLEAN
);

CREATE TABLE inventory (
  id INT PRIMARY KEY,
  ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3),
  threshold NUMERIC(12,3)
);

CREATE TABLE menu_items (
  id INT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(8,2) NOT NULL CHECK (price >= 0),
  availability BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE menu_item_ingredients (
  id INT PRIMARY KEY,
  menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT
);

CREATE TABLE orders (
  id INT PRIMARY KEY,
  order_time TIMESTAMP NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  cashier INT REFERENCES employees(id) ON DELETE SET NULL,
  order_source TEXT NOT NULL DEFAULT 'cashier' CHECK (order_source IN ('cashier', 'kiosk'))
);

CREATE TABLE order_items (
  id INT PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  price_charged NUMERIC(8,2) NOT NULL CHECK (price_charged >= 0),
  menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT
);

CREATE TABLE order_payments (
  order_id INT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  method TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE order_voids (
  order_id INT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  voided_at TIMESTAMP NOT NULL DEFAULT NOW(),
  manager_id INT REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE report_daily_totals (
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

CREATE TABLE z_report_archive (
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

COMMIT;

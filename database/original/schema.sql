-- schema.sql
-- Bubble Tea POS + Inventory Schema
-- Target: PostgreSQL

\set ON_ERROR_STOP on

BEGIN;

-- Drop in dependency order
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_item_ingredients CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- -------------------------
-- TABLES (match CSV columns)
-- -------------------------

-- employees.csv: id, permission, actions, changes
CREATE TABLE employees (
  id          INT PRIMARY KEY,
  permission  TEXT,
  actions     TEXT,
  changes     TEXT
);

-- ingredients.csv: id, name, unit, availability
CREATE TABLE ingredients (
  id            INT PRIMARY KEY,
  name          TEXT NOT NULL,
  unit          TEXT,
  availability  BOOLEAN
);

-- inventory.csv: id, ingredient_id, quantity, threshold
CREATE TABLE inventory (
  id             INT PRIMARY KEY,
  ingredient_id  INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity       NUMERIC(12,3),
  threshold      NUMERIC(12,3)
);

-- menu_items.csv: id, name, price, availability
CREATE TABLE menu_items (
  id            INT PRIMARY KEY,
  name          TEXT NOT NULL,
  price         NUMERIC(8,2) NOT NULL CHECK (price >= 0),
  availability  BOOLEAN NOT NULL DEFAULT TRUE
);

-- menu_item_ingredients.csv: id, menu_item_id, ingredient_id
CREATE TABLE menu_item_ingredients (
  id            INT PRIMARY KEY,
  menu_item_id  INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT
);

-- orders.csv: id, order_time, total_amount, cashier
CREATE TABLE orders (
  id            INT PRIMARY KEY,
  order_time    TIMESTAMP NOT NULL,
  total_amount  NUMERIC(10,2) NOT NULL,
  cashier       INT REFERENCES employees(id) ON DELETE SET NULL
);

-- order_items.csv: id, order_id, quantity, price_charged, menu_item_id
CREATE TABLE order_items (
  id            INT PRIMARY KEY,
  order_id      INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  quantity      INT NOT NULL CHECK (quantity > 0),
  price_charged NUMERIC(8,2) NOT NULL CHECK (price_charged >= 0),
  menu_item_id  INT NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT
);

COMMIT;
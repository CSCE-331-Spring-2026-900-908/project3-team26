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

COMMIT;
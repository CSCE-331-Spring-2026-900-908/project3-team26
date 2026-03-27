# Project 3 Team 26

Full-stack migration of the original Project 2 bubble tea POS system into a web application.

## Project Overview

This repository now contains a React + Vite frontend, a Node.js + Express backend, and PostgreSQL database scripts that preserve the original Project 2 data model and as much business logic as possible.

The migrated app includes:

- home page
- simple role-based login
- cashier POS flow
- manager dashboard and admin tools
- sales/history analytics
- kiosk self-ordering flow
- PostgreSQL-backed order creation

## Original Project Summary

The original Project 2 code was not committed inside this repository. This repo initially contained only a placeholder `README.md`.

I inspected the sibling Project 2 folder at `/Users/harp12/labcsce331/project2` and used that as the migration source. That original Java Swing project included:

- `gui/GUI.java`
  - login flow
  - cashier/manager routing
  - order confirmation and payment helpers
- `gui/CashierPage.java`
  - menu loading from PostgreSQL
  - cashier order creation
  - order/item inserts into `orders` and `order_items`
- `gui/ManagerPage.java`
  - dashboard metrics
  - inventory CRUD
  - menu CRUD
  - employee CRUD
  - order voiding
  - product usage reporting
  - X/Z style report logic
- `queries/schema.sql`
  - base PostgreSQL schema
- `queries/seed.sql`
  - CSV import logic
- `queries/additionalQueries.sql`
  - weekly sales history
  - peak-day reporting
  - total sales
  - top items
  - cashier performance queries
- `queries/special_queries.sql`
  - weekly sales
  - peak-day logic
  - hourly sales
  - menu/inventory usage query
  - “best of the worst” query
- `data/*.csv`
  - employees
  - ingredients
  - inventory
  - menu items
  - menu item ingredient mappings
  - orders
  - order items

## What Was Reused

- Original table structure for:
  - `employees`
  - `ingredients`
  - `inventory`
  - `menu_items`
  - `menu_item_ingredients`
  - `orders`
  - `order_items`
- Original CSV seed data copied into [`database/csv`](/Users/harp12/labcsce331/project3-team26/database/csv)
- Original SQL references copied into [`database/original`](/Users/harp12/labcsce331/project3-team26/database/original)
- Original business behaviors reused in the web version:
  - cashier order creation
  - low-stock inventory checks
  - manager inventory maintenance
  - menu maintenance
  - employee maintenance
  - weekly sales history
  - peak sales day
  - product usage reporting
  - order void tracking
  - payment tracking

## What Was Replaced

- Java Swing UI was replaced by a browser-based React UI.
- JDBC access was replaced by an Express API using `pg`.
- Swing page routing was replaced by `react-router-dom`.
- Swing dashboard components were replaced by web cards, tables, and touch-friendly flows.

## Small Safe Schema Changes

These were added to support the web app while preserving the original design:

- `orders.order_source`
  - values: `cashier` or `kiosk`
- `order_payments`
  - preserves the Project 2 payment-tracking idea
- `order_voids`
  - preserves the manager order-void workflow
- `report_daily_totals`
  - supports X/Z style report summaries
- `z_report_archive`
  - stores closed-day report snapshots

## Current Repository Structure

```text
project3-team26/
├── backend/
│   ├── package.json
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── db/pool.js
│       ├── routes/
│       ├── services/
│       └── utils/
├── database/
│   ├── csv/
│   ├── original/
│   ├── schema.sql
│   ├── seed.sql
│   └── migrations.sql
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── api/
│       ├── components/
│       ├── data/
│       ├── pages/
│       └── styles/
├── .env.example
├── package.json
└── README.md
```

## Migration Strategy Used

1. Audit the real Project 2 code from the sibling repo.
2. Keep the original PostgreSQL schema and CSV-backed data model.
3. Add only minimal schema extensions for kiosk orders and report/payment support.
4. Build a simple Express API around the reused data model and reporting queries.
5. Build a demo-friendly React frontend around the key roles:
   - cashier
   - manager
   - sales
   - kiosk
6. Keep the code beginner-friendly and deployable.

## What Was Missing Or Broken

- The actual original Project 2 source was missing from this repo.
- The repo initially had no backend, no frontend, no SQL files, and no app structure.
- Because of sandbox restrictions, I could compile the frontend and import the backend app successfully, but I could not bind a local server port from inside this environment.

## Database Contents Found

From the reused CSV data:

- 5 employees
- 15 ingredients
- 15 inventory rows
- 16 menu items
- 97 menu-item ingredient mappings
- 60,328 orders
- 180,742 order-item rows

## Implemented Website Pages

- `/`
  - landing page with clear navigation
- `/login`
  - simple role selection
- `/cashier`
  - cashier order flow with menu browsing, cart management, totals, payment method, and order submission
- `/manager`
  - dashboard cards, low-stock inventory display, inventory updates, menu maintenance, employee maintenance, recent orders, order voiding, and report snapshots
- `/sales`
  - weekly history, peak-day summary, hourly activity, top items, and source breakdown
- `/kiosk`
  - demo-ready self-ordering flow with start screen, category filtering, cart editing, checkout, confirmation, and reset for the next customer

## Backend API

Implemented routes include:

- `GET /api/health`
- `GET /api/menu`
- `GET /api/menu/categories`
- `GET /api/inventory`
- `GET /api/orders/:id`
- `POST /api/orders`
- `GET /api/sales/weekly`
- `GET /api/sales/peak-day`
- `GET /api/sales/summary`
- `GET /api/manager/dashboard`
- `GET /api/manager/orders`
- `POST /api/manager/orders/:id/void`
- `GET /api/manager/inventory`
- `POST /api/manager/inventory`
- `PATCH /api/manager/inventory/:ingredientId`
- `DELETE /api/manager/inventory/:ingredientId`
- `GET /api/manager/menu`
- `POST /api/manager/menu`
- `PATCH /api/manager/menu/:id`
- `DELETE /api/manager/menu/:id`
- `GET /api/manager/employees`
- `POST /api/manager/employees`
- `PATCH /api/manager/employees/:id`
- `DELETE /api/manager/employees/:id`
- `GET /api/manager/reports/x`
- `GET /api/manager/reports/z-preview`

## Local Setup

### 1. Install dependencies

From the repo root:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 2. Create environment file

Copy `.env.example` to `.env` at the repo root and update the PostgreSQL values.

Example:

```env
PORT=4000
FRONTEND_URL=http://localhost:5173
PGHOST=localhost
PGPORT=5432
PGDATABASE=bubble_tea_pos
PGUSER=postgres
PGPASSWORD=postgres
DATABASE_URL=
```

### 3. Create the database

```bash
createdb bubble_tea_pos
psql -d bubble_tea_pos -f database/schema.sql
psql -d bubble_tea_pos -f database/seed.sql
```

If you are migrating an existing Project 2 database instead of starting fresh:

```bash
psql -d bubble_tea_pos -f database/migrations.sql
```

### 4. Run the app

Backend:

```bash
npm run dev --prefix backend
```

Frontend:

```bash
npm run dev --prefix frontend
```

Or run both from the root:

```bash
npm run dev
```

## Verification Completed

Verified in this environment:

- frontend production build succeeded with `npm run build` in `frontend/`
- backend module import succeeded
- backend package build script succeeded

Not fully verified here:

- live local server startup, because the sandbox blocked listening on port `4000`
- live PostgreSQL connectivity, because no running database was configured in this environment

## Deployment Notes

### Frontend on Vercel

Use:

- root directory: `frontend`
- build command: `npm run build`
- output directory: `dist`
- environment variable:
  - `VITE_API_URL=https://your-render-backend-url/api`

### Backend on Render

Use:

- root directory: `backend`
- build command: `npm install`
- start command: `npm run start`
- environment variables:
  - `PORT`
  - `FRONTEND_URL`
  - `DATABASE_URL`

### PostgreSQL on Railway or Render Postgres

After creating the database:

1. run `database/schema.sql`
2. run `database/seed.sql`
3. if needed later, run `database/migrations.sql`

## Kiosk Demo Usage

1. Open `/kiosk`.
2. Press `Start Order`.
3. Browse by category.
4. Add drinks to the cart.
5. Edit quantities or remove items.
6. Submit checkout.
7. Show the confirmation screen.
8. Press `Start New Customer Order` to reset for the next demo guest.

Kiosk orders save to the same `orders` and `order_items` tables and are marked with `order_source = 'kiosk'`.

## Major Files Added Or Changed

- [`backend/src/app.js`](/Users/harp12/labcsce331/project3-team26/backend/src/app.js)
- [`backend/src/server.js`](/Users/harp12/labcsce331/project3-team26/backend/src/server.js)
- [`backend/src/routes/menu.js`](/Users/harp12/labcsce331/project3-team26/backend/src/routes/menu.js)
- [`backend/src/routes/orders.js`](/Users/harp12/labcsce331/project3-team26/backend/src/routes/orders.js)
- [`backend/src/routes/sales.js`](/Users/harp12/labcsce331/project3-team26/backend/src/routes/sales.js)
- [`backend/src/routes/manager.js`](/Users/harp12/labcsce331/project3-team26/backend/src/routes/manager.js)
- [`database/schema.sql`](/Users/harp12/labcsce331/project3-team26/database/schema.sql)
- [`database/seed.sql`](/Users/harp12/labcsce331/project3-team26/database/seed.sql)
- [`database/migrations.sql`](/Users/harp12/labcsce331/project3-team26/database/migrations.sql)
- [`frontend/src/App.jsx`](/Users/harp12/labcsce331/project3-team26/frontend/src/App.jsx)
- [`frontend/src/components/OrderStation.jsx`](/Users/harp12/labcsce331/project3-team26/frontend/src/components/OrderStation.jsx)
- [`frontend/src/pages/CashierPage.jsx`](/Users/harp12/labcsce331/project3-team26/frontend/src/pages/CashierPage.jsx)
- [`frontend/src/pages/ManagerPage.jsx`](/Users/harp12/labcsce331/project3-team26/frontend/src/pages/ManagerPage.jsx)
- [`frontend/src/pages/SalesPage.jsx`](/Users/harp12/labcsce331/project3-team26/frontend/src/pages/SalesPage.jsx)
- [`frontend/src/pages/KioskPage.jsx`](/Users/harp12/labcsce331/project3-team26/frontend/src/pages/KioskPage.jsx)
- [`frontend/src/styles/index.css`](/Users/harp12/labcsce331/project3-team26/frontend/src/styles/index.css)

## Assumptions And Limitations

- Because the original Project 2 code was outside this repo, the migration uses the sibling `project2` folder as the source of truth.
- Kiosk and cashier both write into the same core order tables; they are separated by `order_source`.
- Menu categories are inferred from item names because the original schema did not contain a category column.
- The current web version keeps the business logic simple and readable rather than recreating every Swing interaction one-for-one.

import { Router } from 'express';
import { query, withClient } from '../db/pool.js';
import { getSchemaSupport } from '../db/compat.js';
import { buildXReport, buildZPreview } from '../services/reporting.js';

const router = Router();

async function nextId(client, table) {
  const result = await client.query(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ${table}`);
  return Number(result.rows[0].next_id);
}

router.get('/dashboard', async (_req, res, next) => {
  try {
    const support = await getSchemaSupport();
    const [totals, lowStock, recentOrders, productUsage] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int AS orders,
           COALESCE(SUM(total_amount), 0) AS sales,
           COALESCE(AVG(total_amount), 0) AS average_order,
           COUNT(DISTINCT cashier)::int AS active_cashiers
         FROM orders`
      ),
      query(
        `SELECT i.id AS ingredient_id, i.name, inv.quantity, inv.threshold
         FROM inventory inv
         JOIN ingredients i ON i.id = inv.ingredient_id
         WHERE inv.quantity <= inv.threshold
         ORDER BY inv.quantity ASC, i.name ASC
         LIMIT 10`
      ),
      query(
        `SELECT o.id, o.order_time, o.total_amount,
                ${support.hasOrderSource ? 'o.order_source,' : "'cashier' AS order_source,"}
                ${support.hasOrderVoids ? "CASE WHEN ov.order_id IS NULL THEN 'ACTIVE' ELSE 'VOIDED' END AS status" : "'ACTIVE' AS status"}
         FROM orders o
         ${support.hasOrderVoids ? 'LEFT JOIN order_voids ov ON ov.order_id = o.id' : ''}
         ORDER BY o.id DESC
         LIMIT 10`
      ),
      query(
        `SELECT i.id AS ingredient_id, i.name, i.unit,
                COALESCE(SUM(oi.quantity), 0)::numeric AS units_used
         FROM ingredients i
         LEFT JOIN menu_item_ingredients mii ON mii.ingredient_id = i.id
         LEFT JOIN order_items oi ON oi.menu_item_id = mii.menu_item_id
         GROUP BY i.id, i.name, i.unit
         ORDER BY units_used DESC, i.name
         LIMIT 10`
      ),
    ]);

    res.json({
      totals: {
        orders: Number(totals.rows[0].orders),
        sales: Number(totals.rows[0].sales),
        averageOrder: Number(totals.rows[0].average_order),
        activeCashiers: Number(totals.rows[0].active_cashiers),
      },
      lowStock: lowStock.rows,
      recentOrders: recentOrders.rows,
      productUsage: productUsage.rows.map((row) => ({
        ingredientId: Number(row.ingredient_id),
        name: row.name,
        unit: row.unit,
        unitsUsed: Number(row.units_used),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/orders', async (_req, res, next) => {
  try {
    const support = await getSchemaSupport();
    const result = await query(
      `SELECT o.id, o.order_time, o.total_amount, o.cashier,
              ${support.hasOrderSource ? 'o.order_source,' : "'cashier' AS order_source,"}
              ${support.hasOrderVoids ? "CASE WHEN ov.order_id IS NULL THEN 'ACTIVE' ELSE 'VOIDED' END AS status, ov.voided_at, ov.manager_id" : "'ACTIVE' AS status, NULL AS voided_at, NULL AS manager_id"}
       FROM orders o
       ${support.hasOrderVoids ? 'LEFT JOIN order_voids ov ON ov.order_id = o.id' : ''}
       ORDER BY o.id DESC
       LIMIT 250`
    );
    res.json({ orders: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:id/void', async (req, res, next) => {
  const orderId = Number(req.params.id);
  const managerId = req.body?.managerId || null;

  try {
    const support = await getSchemaSupport();
    if (!support.hasOrderVoids) {
      return res.status(400).json({ error: 'Order voiding is unavailable on the original Project 2 schema.' });
    }
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const orderResult = await client.query(
          'SELECT order_time::date AS business_date FROM orders WHERE id = $1',
          [orderId]
        );
        if (orderResult.rowCount === 0) {
          throw new Error('Order not found.');
        }

        const alreadyVoided = await client.query(
          'SELECT COUNT(*)::int AS count FROM order_voids WHERE order_id = $1',
          [orderId]
        );
        if (Number(alreadyVoided.rows[0].count) > 0) {
          throw new Error('Order is already voided.');
        }

        await client.query(
          `INSERT INTO order_voids(order_id, business_date, voided_at, manager_id)
           VALUES ($1, $2, NOW(), $3)`,
          [orderId, orderResult.rows[0].business_date, managerId]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/inventory', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT i.id AS ingredient_id, i.name, i.unit, i.availability, inv.quantity, inv.threshold
       FROM inventory inv
       JOIN ingredients i ON i.id = inv.ingredient_id
       ORDER BY i.id`
    );
    res.json({ items: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/inventory', async (req, res, next) => {
  const { name, unit, quantity, threshold, availability } = req.body || {};
  try {
    const item = await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const ingredientId = await nextId(client, 'ingredients');
        const inventoryId = await nextId(client, 'inventory');
        await client.query(
          'INSERT INTO ingredients(id, name, unit, availability) VALUES ($1, $2, $3, $4)',
          [ingredientId, name, unit || null, availability ?? true]
        );
        await client.query(
          'INSERT INTO inventory(id, ingredient_id, quantity, threshold) VALUES ($1, $2, $3, $4)',
          [inventoryId, ingredientId, quantity, threshold]
        );
        await client.query('COMMIT');
        return { ingredientId, name, unit, quantity, threshold, availability: availability ?? true };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

router.patch('/inventory/:ingredientId', async (req, res, next) => {
  const ingredientId = Number(req.params.ingredientId);
  const { delta, threshold, availability } = req.body || {};

  try {
    if (delta !== undefined) {
      await query('UPDATE inventory SET quantity = quantity + $1 WHERE ingredient_id = $2', [delta, ingredientId]);
    }
    if (threshold !== undefined) {
      await query('UPDATE inventory SET threshold = $1 WHERE ingredient_id = $2', [threshold, ingredientId]);
    }
    if (availability !== undefined) {
      await query('UPDATE ingredients SET availability = $1 WHERE id = $2', [availability, ingredientId]);
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/inventory/:ingredientId', async (req, res, next) => {
  const ingredientId = Number(req.params.ingredientId);
  try {
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await client.query('DELETE FROM menu_item_ingredients WHERE ingredient_id = $1', [ingredientId]);
        await client.query('DELETE FROM ingredients WHERE id = $1', [ingredientId]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/menu', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT m.id, m.name, m.price, m.availability,
              COALESCE(STRING_AGG(mi.ingredient_id::text, ', ' ORDER BY mi.ingredient_id), '') AS ingredient_ids
       FROM menu_items m
       LEFT JOIN menu_item_ingredients mi ON mi.menu_item_id = m.id
       GROUP BY m.id, m.name, m.price, m.availability
       ORDER BY m.id`
    );
    res.json({ items: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/menu', async (req, res, next) => {
  const { id, name, price, availability, ingredientIds = [] } = req.body || {};
  try {
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const menuId = id || (await nextId(client, 'menu_items'));
        await client.query(
          'INSERT INTO menu_items(id, name, price, availability) VALUES ($1, $2, $3, $4)',
          [menuId, name, price, availability ?? true]
        );

        let relationId = await nextId(client, 'menu_item_ingredients');
        for (const ingredientId of ingredientIds) {
          await client.query(
            'INSERT INTO menu_item_ingredients(id, menu_item_id, ingredient_id) VALUES ($1, $2, $3)',
            [relationId, menuId, ingredientId]
          );
          relationId += 1;
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.patch('/menu/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  const { name, price, availability, ingredientIds } = req.body || {};
  try {
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await client.query(
          `UPDATE menu_items
           SET name = COALESCE($1, name),
               price = COALESCE($2, price),
               availability = COALESCE($3, availability)
           WHERE id = $4`,
          [name ?? null, price ?? null, availability ?? null, id]
        );
        if (Array.isArray(ingredientIds)) {
          await client.query('DELETE FROM menu_item_ingredients WHERE menu_item_id = $1', [id]);
          let relationId = await nextId(client, 'menu_item_ingredients');
          for (const ingredientId of ingredientIds) {
            await client.query(
              'INSERT INTO menu_item_ingredients(id, menu_item_id, ingredient_id) VALUES ($1, $2, $3)',
              [relationId, id, ingredientId]
            );
            relationId += 1;
          }
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/menu/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  try {
    const usage = await query('SELECT COUNT(*)::int AS count FROM order_items WHERE menu_item_id = $1', [id]);
    if (Number(usage.rows[0].count) > 0) {
      await query('UPDATE menu_items SET availability = FALSE WHERE id = $1', [id]);
    } else {
      await query('DELETE FROM menu_items WHERE id = $1', [id]);
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/employees', async (_req, res, next) => {
  try {
    const result = await query('SELECT id, permission, actions, changes FROM employees ORDER BY id');
    res.json({ employees: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/employees', async (req, res, next) => {
  const { id, permission, actions, changes } = req.body || {};
  try {
    await query(
      'INSERT INTO employees(id, permission, actions, changes) VALUES ($1, $2, $3, $4)',
      [id, permission, actions || null, changes || null]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.patch('/employees/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  const { permission, actions, changes } = req.body || {};
  try {
    await query(
      `UPDATE employees
       SET permission = COALESCE($1, permission),
           actions = COALESCE($2, actions),
           changes = COALESCE($3, changes)
       WHERE id = $4`,
      [permission ?? null, actions ?? null, changes ?? null, id]
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/employees/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  try {
    await query('DELETE FROM employees WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
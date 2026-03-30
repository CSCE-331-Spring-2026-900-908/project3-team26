import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  const lowOnly = req.query.lowStock === 'true';
  try {
    const sql = lowOnly
      ? `SELECT
           i.id AS ingredient_id,
           i.name,
           i.unit,
           i.availability,
           inv.quantity,
           inv.threshold,
           (inv.quantity <= inv.threshold) AS low_stock
         FROM inventory inv
         JOIN ingredients i ON i.id = inv.ingredient_id
         WHERE inv.quantity <= inv.threshold
         ORDER BY i.id`
      : `SELECT
           i.id AS ingredient_id,
           i.name,
           i.unit,
           i.availability,
           inv.quantity,
           inv.threshold,
           (inv.quantity <= inv.threshold) AS low_stock
         FROM inventory inv
         JOIN ingredients i ON i.id = inv.ingredient_id
         ORDER BY i.id`;

    const result = await query(sql);
    res.json({
      items: result.rows.map((row) => ({
        ingredientId: Number(row.ingredient_id),
        name: row.name,
        unit: row.unit,
        availability: row.availability,
        quantity: Number(row.quantity),
        threshold: Number(row.threshold),
        lowStock: row.low_stock,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
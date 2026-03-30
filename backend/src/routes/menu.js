import { Router } from 'express';
import { query } from '../db/pool.js';
import { getCategoryForName, groupMenuByCategory } from '../utils/menu.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT
         m.id,
         m.name,
         m.price,
         m.availability,
         COALESCE(STRING_AGG(i.name, ', ' ORDER BY i.name), '') AS ingredients
       FROM menu_items m
       LEFT JOIN menu_item_ingredients mi ON mi.menu_item_id = m.id
       LEFT JOIN ingredients i ON i.id = mi.ingredient_id
       GROUP BY m.id, m.name, m.price, m.availability
       ORDER BY m.id`
    );

    const items = result.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      price: Number(row.price),
      availability: row.availability,
      ingredients: row.ingredients ? row.ingredients.split(', ').filter(Boolean) : [],
      category: getCategoryForName(row.name),
    }));

    res.json({
      items,
      grouped: groupMenuByCategory(items.filter((item) => item.availability)),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (_req, res, next) => {
  try {
    const result = await query('SELECT id, name, availability FROM menu_items ORDER BY id');
    const categories = [...new Set(result.rows.map((row) => getCategoryForName(row.name)))];
    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

export default router;

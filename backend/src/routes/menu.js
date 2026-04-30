// Public menu route: /api/menu
// Returns all menu items joined with their ingredient names, bucketed into categories.
// Used by the kiosk and cashier pages to populate the drink grid on load.
import { Router } from 'express';
import { query } from '../db/pool.js';
import { getCategoryForName, groupMenuByCategory } from '../utils/menu.js';

const router = Router();
// Packaging items that are ingredients in the DB but shouldn't be shown to customers.
const hiddenIngredients = new Set(['Cups', 'Lids', 'Straws']);

// GET /api/menu — returns { items, grouped }.
// items: flat list of all menu items with ingredients and category.
// grouped: same list filtered to available items, keyed by category (for easy rendering).
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

    const items = result.rows.map((row) => {
      const ingredients = row.ingredients
        ? row.ingredients
            .split(', ')
            .filter(Boolean)
            .filter((ingredient) => !hiddenIngredients.has(ingredient))
        : [];

      return {
        id: Number(row.id),
        name: row.name,
        price: Number(row.price),
        availability: row.availability,
        ingredients,
        category: getCategoryForName(row.name),
      };
    });

    res.json({
      items,
      grouped: groupMenuByCategory(items.filter((item) => item.availability)),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/categories — returns the distinct category names derived from item names.
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

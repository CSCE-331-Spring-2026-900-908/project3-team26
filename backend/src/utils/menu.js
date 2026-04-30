// Shared category-bucketing logic used by both the menu route and the manager route.
// Keeps the kiosk filter categories in sync with the manager's category column
// without duplicating keyword logic across files.
// Add category keyword changes here first so every backend response stays aligned.

// Drinks that would be mis-categorized by keyword matching and need an explicit override.
const SPECIALTY_OVERRIDES = new Set([
  'creme brulee milk tea',
]);

// Buckets a menu item name into one of four categories: Milk Tea, Fruit Tea, Slush, Specialty.
// Used server-side so every API response carries the same category the frontend displays.
export function getCategoryForName(name = '') {
  const normalized = name.toLowerCase().trim();
  if (SPECIALTY_OVERRIDES.has(normalized)) {
    return 'Specialty';
  }
  if (normalized.includes('slush')) {
    return 'Slush';
  }
  if (
    normalized.includes('green tea') ||
    normalized.includes('black tea') ||
    normalized.includes('oolong tea') ||
    normalized.includes('fruit tea') ||
    normalized.includes('passionfruit') ||
    normalized.includes('lychee')
  ) {
    return 'Fruit Tea';
  }
  if (normalized.includes('milk tea') || normalized.includes('latte')) {
    return 'Milk Tea';
  }
  return 'Specialty';
}

// Reduces a flat array of menu items into an object keyed by category.
// Used by the /api/menu route to return a grouped view alongside the flat list.
export function groupMenuByCategory(menuItems) {
  return menuItems.reduce((groups, item) => {
    const category = item.category || getCategoryForName(item.name);
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {});
}

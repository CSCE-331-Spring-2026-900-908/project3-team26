// Maps menu item names from the database to their image files.
// Images live in frontend/public/images/menu/ and are served at /images/menu/<file>
// To add a new image: drop the file into public/images/menu/ and add an entry below.
// Lookups are case-insensitive (see normalize() below) so DB rows can use any casing.
// The fallback path keeps the UI usable if a new menu item has no dedicated asset yet.

const imageMap = {
  'classic milk tea': '/images/menu/classic-milk-tea.jpg',
  'brown sugar milk tea': '/images/menu/brown-sugar-milk-tea.png',
  'thai milk tea': '/images/menu/thai-milk-tea.jpg',
  'taro milk tea': '/images/menu/taro-milk-tea.png',
  'matcha latte': '/images/menu/matcha-latte.png',
  'jasmine green milk tea': '/images/menu/jasmine-green-milk-tea.png',
  'oolong milk tea': '/images/menu/oolong-milk-tea.png',
  'honeydew milk tea': '/images/menu/honeydew-milk-tea.png',
  'mango green tea': '/images/menu/mango-green-tea.png',
  'strawberry green tea': '/images/menu/strawberry-green-tea.png',
  'passionfruit black tea': '/images/menu/passionfruit-black-tea.png',
  'peach oolong tea': '/images/menu/peach-oolong-tea.png',
  'lychee slush': '/images/menu/lychee-slush.png',
  'mango slush': '/images/menu/mango-slush.png',
  'coffee milk tea': '/images/menu/coffee-milk-tea.png',
  'wintermelon milk tea': '/images/menu/wintermelon-milk-tea.png',
  'taro coconut latte': '/images/menu/taro-coconut-latte.png',
  'brown sugar coconut latte': '/images/menu/brown-sugar-coconut-latte.png',
  'coconut lychee cooler': '/images/menu/coconut-lychee-cooler.png',
  'strawberry lychee slush': '/images/menu/strawberry-lychee-slush.png',
  'jasmine coconut milk tea': '/images/menu/jasmine-coconut-milk-tea.png',
  'oolong coconut milk tea': '/images/menu/oolong-coconut-milk-tea.png',
  'brown sugar cream latte': '/images/menu/brown-sugar-cream-latte.png',
  'taro cream latte': '/images/menu/taro-cream-latte.png',
  'pineapple coconut slush': '/images/menu/pineapple-coconut-slush.png',
  'watermelon lime slush': '/images/menu/watermelon-lime-slush.png',
  'peach mango slush': '/images/menu/peach-mango-slush.png',
  'strawberry matcha cream': '/images/menu/strawberry-matcha-cream.png',
  'creme brulee milk tea': '/images/menu/creme-brulee-milk-tea.png',
};

const PLACEHOLDER = '/images/menu/placeholder.jpg';

// Lower-cases and trims the lookup key so the map matches DB rows regardless of casing/whitespace.
function normalize(name) {
  return String(name || '').trim().toLowerCase();
}

// Returns the image path for the given drink, or null if no entry exists.
// Used by KioskPage and CashierPage to render menu thumbnails.
export function getMenuImage(name) {
  const key = normalize(name);
  return imageMap[key] || null;
}

// Same as getMenuImage but falls back to a generic placeholder image when no entry matches.
export function getMenuImageOrPlaceholder(name) {
  return getMenuImage(name) || PLACEHOLDER;
}

// Exports the raw lowercase keys
export const knownMenuItemNames = Object.keys(imageMap);

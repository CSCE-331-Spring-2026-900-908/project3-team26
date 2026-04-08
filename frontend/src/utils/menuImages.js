// Maps menu item names from the database to their image files.
// Images live in frontend/public/images/menu/ and are served at /images/menu/<file>
// To add a new image: drop the file into public/images/menu/ and add an entry below.

const imageMap = {
  'classic milk tea': '/images/menu/classic-milk-tea.jpg',
};

const PLACEHOLDER = '/images/menu/placeholder.jpg';

function normalize(name) {
  return String(name || '').trim().toLowerCase();
}

export function getMenuImage(name) {
  const key = normalize(name);
  return imageMap[key] || null;
}

export function getMenuImageOrPlaceholder(name) {
  return getMenuImage(name) || PLACEHOLDER;
}

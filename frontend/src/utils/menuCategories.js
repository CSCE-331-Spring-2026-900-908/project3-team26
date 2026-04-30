// Canonical category list and normalizer used by the kiosk filters.
export const categoryNames = ['Milk Tea', 'Fruit Tea', 'Slush', 'Specialty'];

export function normalizeMenuItem(item) {
  return {
    ...item,
    category: item.category || 'Specialty',
  };
}

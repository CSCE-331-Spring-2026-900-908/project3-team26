// Canonical category list and normalizer used by the kiosk filters.
// Add new category labels here before wiring them into page filter controls.
export const categoryNames = ['Milk Tea', 'Fruit Tea', 'Slush', 'Specialty'];

export function normalizeMenuItem(item) {
  return {
    ...item,
    category: item.category || 'Specialty',
  };
}

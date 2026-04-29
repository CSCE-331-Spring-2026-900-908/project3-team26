export const categoryNames = ['Milk Tea', 'Fruit Tea', 'Slush', 'Specialty'];

export function normalizeMenuItem(item) {
  return {
    ...item,
    category: item.category || 'Specialty',
  };
}

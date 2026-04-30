// Menu grouping helpers shared by older backend utilities/tests.
// The frontend has its own normalization layer, but this keeps backend category names consistent.
// This legacy helper mirrors the newer menu utility without importing React.
export function getCategoryForName(name = '') {
  const normalized = name.toLowerCase();
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

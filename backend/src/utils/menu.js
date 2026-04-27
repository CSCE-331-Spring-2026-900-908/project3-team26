const SPECIALTY_OVERRIDES = new Set([
  'creme brulee milk tea',
]);

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

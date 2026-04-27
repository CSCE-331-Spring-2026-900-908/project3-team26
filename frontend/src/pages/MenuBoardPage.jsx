import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const fallbackMenuItems = [
  { id: 1, name: 'Classic Milk Tea', price: 4.79, availability: true },
  { id: 2, name: 'Brown Sugar Milk Tea', price: 5.29, availability: true },
  { id: 3, name: 'Thai Milk Tea', price: 4.99, availability: true },
  { id: 4, name: 'Taro Milk Tea', price: 5.19, availability: true },
  { id: 5, name: 'Matcha Latte', price: 5.49, availability: true },
  { id: 6, name: 'Jasmine Green Milk Tea', price: 4.89, availability: true },
  { id: 7, name: 'Oolong Milk Tea', price: 4.89, availability: true },
  { id: 8, name: 'Honeydew Milk Tea', price: 5.19, availability: true },
  { id: 9, name: 'Mango Green Tea', price: 4.99, availability: true },
  { id: 10, name: 'Strawberry Green Tea', price: 4.99, availability: true },
  { id: 11, name: 'Passionfruit Black Tea', price: 4.89, availability: true },
  { id: 12, name: 'Peach Oolong Tea', price: 4.89, availability: true },
  { id: 13, name: 'Lychee Slush', price: 5.29, availability: true },
  { id: 14, name: 'Mango Slush', price: 5.29, availability: true },
  { id: 15, name: 'Coffee Milk Tea', price: 5.09, availability: true },
  { id: 16, name: 'Wintermelon Milk Tea', price: 4.99, availability: true },
  { id: 17, name: 'Taro Coconut Latte', price: 5.29, availability: true },
  { id: 18, name: 'Brown Sugar Coconut Latte', price: 5.39, availability: true },
  { id: 19, name: 'Coconut Lychee Cooler', price: 5.19, availability: true },
  { id: 20, name: 'Strawberry Lychee Slush', price: 5.29, availability: true },
  { id: 21, name: 'Jasmine Coconut Milk Tea', price: 5.19, availability: true },
  { id: 22, name: 'Oolong Coconut Milk Tea', price: 5.19, availability: true },
  { id: 23, name: 'Taro Cream Latte', price: 5.29, availability: true },
  { id: 24, name: 'Brown Sugar Cream Latte', price: 5.39, availability: true },
];

const sectionOrder = [
  { key: 'milk', title: 'Milk Teas', badge: 'MT' },
  { key: 'fruit', title: 'Fruit Teas', badge: 'FT' },
  { key: 'specialty', title: 'Tea & Specialty', badge: 'TS' },
];

const sugarLevels = ['0% Sugar', '25% Sugar', '50% Sugar', '75% Sugar', '100% Sugar'];
const iceLevels = ['No Ice', 'Less Ice', 'Regular Ice', 'Extra Ice'];
const toppingOptions = [
  'Tapioca Pearls',
  'Mini Pearls',
  'Popping Boba',
  'Grass Jelly',
  'Aloe Vera',
  'Pudding',
];

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getBoardSection(item) {
  const normalized = item.name.toLowerCase();

  if (normalized.includes('milk tea')) {
    return 'milk';
  }

  if (
    normalized.includes('green tea') ||
    normalized.includes('black tea') ||
    normalized.includes('oolong tea') ||
    normalized.includes('slush') ||
    normalized.includes('cooler')
  ) {
    return 'fruit';
  }

  return 'specialty';
}

function buildSections(menuItems) {
  return menuItems.reduce(
    (sections, item) => {
      const key = getBoardSection(item);
      sections[key].push(item);
      return sections;
    },
    { milk: [], fruit: [], specialty: [] }
  );
}

export default function MenuBoardPage() {
  const [menuItems, setMenuItems] = useState(fallbackMenuItems);
  const [bannerText, setBannerText] = useState('Loading menu...');
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    api
      .get('/menu')
      .then((data) => {
        if (!isMounted) {
          return;
        }

        const availableItems = (data.items || []).filter((item) => item.availability);
        setMenuItems(availableItems.length ? availableItems : fallbackMenuItems);
        setBannerText('Menu loaded');
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setMenuItems(fallbackMenuItems);
        setBannerText('Menu loaded');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const boardSections = useMemo(() => buildSections(menuItems), [menuItems]);
  const featuredItems = useMemo(() => menuItems.slice(0, 8), [menuItems]);
  const currentTime = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(clock),
    [clock]
  );

  return (
    <section className="menu-board-page">
      <div className="menu-board-shell">
        <header className="menu-board-header">
          <div className="menu-board-brand">
            <p>Artisan Bubble Tea</p>
            <h1>TEAM 26&apos;S SHOP</h1>
          </div>

          <div className="menu-board-status">
            <span>{currentTime}</span>
            <span>Estimated wait unavailable</span>
            <span>Now Serving</span>
          </div>
        </header>

        <div className="menu-board-banner">{bannerText}</div>

        <div className="menu-board-tabs" aria-label="Featured drinks">
          {featuredItems.map((item) => (
            <span key={item.id} className="menu-board-tab">
              {item.name}
            </span>
          ))}
        </div>

        <div className="menu-board-sections">
          {sectionOrder.map((section) => (
            <article key={section.key} className={`menu-board-card ${section.key}`}>
              <div className="menu-board-card-title">
                <span className="menu-board-section-badge">{section.badge}</span>
                <h2>{section.title}</h2>
              </div>

              <div className="menu-board-list">
                {boardSections[section.key].map((item) => (
                  <div key={item.id} className="menu-board-item">
                    <span>{item.name}</span>
                    <strong>{formatCurrency(item.price)}</strong>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="menu-board-customizations">
          <section className="menu-board-options">
            <h3>Sugar Level</h3>
            <div className="menu-board-chip-row sugar">
              {sugarLevels.map((option) => (
                <span key={option} className="menu-board-chip">
                  {option}
                </span>
              ))}
            </div>
          </section>

          <section className="menu-board-options">
            <h3>Ice Level</h3>
            <div className="menu-board-chip-row ice">
              {iceLevels.map((option) => (
                <span key={option} className="menu-board-chip">
                  {option}
                </span>
              ))}
            </div>
          </section>

          <section className="menu-board-options">
            <h3>Toppings</h3>
            <div className="menu-board-chip-row toppings">
              {toppingOptions.map((option) => (
                <span key={option} className="menu-board-chip">
                  {option}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

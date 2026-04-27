import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { logoutUser } from '../utils/session.js';
import { getMenuImage } from '../utils/menuImages.js';
import { categoryNames, normalizeMenuItem } from '../utils/menuCategories.js';

const sizes = ['Small', 'Medium', 'Large'];
const sugarLevels = ['0%', '25%', '50%', '75%', '100%'];
const iceLevels = ['No Ice', 'Less Ice', 'Regular'];
const addOnOptions = ['Boba', 'Jelly', 'Cheese Foam'];

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function CashierPage() {
  const navigate = useNavigate();
  const employeeId = localStorage.getItem('team26-employee-id') || '2';
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Milk Tea');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [size, setSize] = useState('Medium');
  const [sugar, setSugar] = useState('75%');
  const [ice, setIce] = useState('Regular');
  const [addons, setAddons] = useState([]);
  const [orderLines, setOrderLines] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadMenu() {
      try {
        const data = await api.get('/menu');
        if (active) {
          setMenuItems(data.items.filter((item) => item.availability).map(normalizeMenuItem));
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      }
    }

    loadMenu();
    const intervalId = window.setInterval(loadMenu, 10000);
    window.addEventListener('focus', loadMenu);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', loadMenu);
    };
  }, []);

  useEffect(() => {
    if (selectedItemId && !menuItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [menuItems, selectedItemId]);

  const visibleItems = useMemo(
    () => menuItems.filter((item) => item.category === activeCategory),
    [menuItems, activeCategory]
  );

  const selectedItem = menuItems.find((item) => item.id === selectedItemId) || null;

  const total = orderLines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  function toggleAddon(addon) {
    setAddons((current) =>
      current.includes(addon) ? current.filter((entry) => entry !== addon) : [...current, addon]
    );
  }

  function addSelectedToOrder() {
    if (!selectedItem) {
      window.alert('Choose a menu item first.');
      return;
    }

    const customizationKey = JSON.stringify({ size, sugar, ice, addons: [...addons].sort() });
    setOrderLines((current) => {
      const existing = current.find(
        (line) => line.menuItemId === selectedItem.id && line.customizationKey === customizationKey
      );

      if (existing) {
        return current.map((line) =>
          line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }

      return [
        ...current,
        {
          id: `${selectedItem.id}-${Date.now()}`,
          menuItemId: selectedItem.id,
          name: selectedItem.name,
          price: Number(selectedItem.price),
          quantity: 1,
          size,
          sugar,
          ice,
          addons,
          customizationKey,
        },
      ];
    });
  }

  function clearOrder() {
    setOrderLines([]);
    setSelectedItemId(null);
    setSize('Medium');
    setSugar('75%');
    setIce('Regular');
    setAddons([]);
    setConfirmation(null);
  }

  async function submitOrder() {
    if (!orderLines.length) {
      window.alert('Add at least one item to order.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const grouped = new Map();
      for (const line of orderLines) {
        const current = grouped.get(line.menuItemId) || 0;
        grouped.set(line.menuItemId, current + line.quantity);
      }

      const payload = {
        source: 'cashier',
        cashierId: Number(employeeId),
        paymentMethod: 'CASH',
        items: [...grouped.entries()].map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
      };

      const result = await api.post('/orders', payload);
      setConfirmation(result.order);
      clearOrder();
      setConfirmation(result.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="cashier-page">
      <div className="swing-header">
        <h1>CASHIER - ORDER ENTRY</h1>
        <div className="swing-header-actions">
          <span>Employee #{employeeId}</span>
          <button onClick={() => logoutUser(navigate)}>[LOGOUT]</button>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {confirmation ? (
        <div className="swing-panel cashier-confirmation">
          <h2>ORDER SUBMITTED</h2>
          <p>
            Order #{confirmation.id} saved at {new Date(confirmation.orderTime).toLocaleString()}
          </p>
          <strong>{formatCurrency(confirmation.totalAmount)}</strong>
        </div>
      ) : null}

      <div className="cashier-layout">
        <div className="cashier-main">
          <section className="swing-panel">
            <div className="panel-title">CATEGORIES</div>
            <div className="cashier-categories">
              {categoryNames.map((category) => (
                <button
                  key={category}
                  className={category === activeCategory ? 'swing-button active' : 'swing-button'}
                  onClick={() => {
                    setActiveCategory(category);
                    setSelectedItemId(null);
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          </section>

          <section className="swing-panel">
            <div className="panel-title">MENU ITEMS</div>
            <div className="cashier-menu-grid">
              {visibleItems.length ? (
                visibleItems.map((item) => {
                  const imageSrc = getMenuImage(item.name);
                  return (
                    <button
                      key={item.id}
                      className={item.id === selectedItemId ? 'menu-tile active' : 'menu-tile'}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={item.name}
                          className="menu-tile-image"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <span className="menu-tile-name">{item.name}</span>
                      <strong>{formatCurrency(item.price)}</strong>
                    </button>
                  );
                })
              ) : (
                <div className="cashier-empty-state helper-text">
                  No available menu items in this category.
                </div>
              )}
            </div>
          </section>

          <section className="swing-panel">
            <div className="panel-title">CUSTOMIZATION</div>
            <div className="cashier-customization">
              <label className="swing-field">
                <span>Size</span>
                <select value={size} onChange={(event) => setSize(event.target.value)}>
                  {sizes.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
              </label>
              <label className="swing-field">
                <span>Sugar</span>
                <select value={sugar} onChange={(event) => setSugar(event.target.value)}>
                  {sugarLevels.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
              </label>
              <label className="swing-field">
                <span>Ice</span>
                <select value={ice} onChange={(event) => setIce(event.target.value)}>
                  {iceLevels.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="addon-row">
              {addOnOptions.map((addon) => (
                <label key={addon} className="addon-option">
                  <input
                    type="checkbox"
                    checked={addons.includes(addon)}
                    onChange={() => toggleAddon(addon)}
                  />
                  <span>{addon}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="swing-panel current-order-panel">
          <div className="panel-title">CURRENT ORDER</div>
          <div className="order-list-box">
            {orderLines.length ? (
              orderLines.map((line) => (
                <div className="order-line" key={line.id}>
                  <div>
                    <strong>
                      {line.quantity} x {line.name}
                    </strong>
                    <p>
                      {line.size}, {line.sugar}, {line.ice}
                      {line.addons.length ? ` | Add-ons: ${line.addons.join(', ')}` : ' | Add-ons: None'}
                    </p>
                  </div>
                  <span>{formatCurrency(line.price * line.quantity)}</span>
                </div>
              ))
            ) : (
              <p className="helper-text">No items added yet.</p>
            )}
          </div>
          <div className="current-order-footer">
            <div className="total-strip">TOTAL: {formatCurrency(total)}</div>
            <button className="swing-primary" disabled={submitting} onClick={submitOrder}>
              {submitting ? 'SUBMITTING...' : 'SUBMIT ORDER'}
            </button>
          </div>
        </aside>
      </div>

      <div className="cashier-bottom-bar">
        <button className="swing-primary" onClick={addSelectedToOrder}>
          ADD TO ORDER
        </button>
        <button className="swing-secondary" onClick={clearOrder}>
          CLEAR
        </button>
      </div>
    </section>
  );
}

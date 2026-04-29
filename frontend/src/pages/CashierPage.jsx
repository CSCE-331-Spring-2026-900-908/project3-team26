// CashierPage: in-store POS view at "/cashier" used by employees to ring up walk-in orders.
// Loads the menu from /menu, lets the cashier pick a drink + customization, build a list of
// order lines, and submit the order via POST /orders. The submitted order is written to the
// orders + order_items tables in PostgreSQL.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { logoutUser } from '../utils/session.js';
import { getMenuImage } from '../utils/menuImages.js';
import { categoryNames, normalizeMenuItem } from '../utils/menuCategories.js';

const sizes = ['Small', 'Medium', 'Large'];
const temperatureOptions = ['Cold', 'Hot'];
const sugarLevels = ['0%', '25%', '50%', '75%', '100%', '125%', '150%'];
const iceLevels = ['No Ice', 'Less Ice', 'Regular'];
const addOnOptions = ['Boba', 'Jelly', 'Cheese Foam'];
const defaultCustomization = {
  size: 'Medium',
  temperature: 'Cold',
  sugar: '75%',
  ice: 'Regular',
  addons: [],
  quantity: 1,
};

// Buckets a drink into one of four categories based on keywords in its name.
function getCategory(name = '') {
  const normalized = name.toLowerCase();
  if (normalized.includes('milk tea') || normalized.includes('latte')) {
    return 'Milk Tea';
  }
  if (
    normalized.includes('green tea') ||
    normalized.includes('black tea') ||
    normalized.includes('oolong tea') ||
    normalized.includes('lychee') ||
    normalized.includes('passionfruit')
  ) {
    return 'Fruit Tea';
  }
  if (normalized.includes('slush')) {
    return 'Slush';
  }
  return 'Specialty';
}

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getCustomizationKey(customization) {
  return JSON.stringify({
    size: customization.size,
    temperature: customization.temperature,
    sugar: customization.sugar,
    ice: customization.ice,
    addons: [...customization.addons].sort(),
  });
}

export default function CashierPage() {
  const navigate = useNavigate();
  // Employee ID is saved in localStorage at login by saveUserSession() in utils/session.js.
  const employeeId = localStorage.getItem('team26-employee-id') || '2';
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Milk Tea');
  const [customizationModal, setCustomizationModal] = useState(null);
  const [orderLines, setOrderLines] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');

  // Loads the menu from the backend on mount; only available items are shown.
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
    if (
      customizationModal?.mode === 'add' &&
      !menuItems.some((item) => item.id === customizationModal.menuItem.id)
    ) {
      setCustomizationModal(null);
    }
  }, [customizationModal, menuItems]);

  const visibleItems = useMemo(
    () => menuItems.filter((item) => item.category === activeCategory),
    [menuItems, activeCategory]
  );

  const total = orderLines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const modalItem = customizationModal?.menuItem || null;
  const modalDraft = customizationModal?.draft || defaultCustomization;
  const modalLineTotal = modalItem
    ? Number(modalItem.price) * Math.max(1, Number(modalDraft.quantity) || 1)
    : 0;

  function openAddModal(item) {
    setConfirmation(null);
    setCustomizationModal({
      mode: 'add',
      menuItem: item,
      draft: createDefaultCustomization(),
    });
  }

  function openEditModal(line) {
    setCustomizationModal({
      mode: 'edit',
      lineId: line.id,
      menuItem: {
        id: line.menuItemId,
        name: line.name,
        price: line.price,
      },
      draft: {
        size: line.size,
        temperature: line.temperature || 'Cold',
        sugar: line.sugar,
        ice: line.ice,
        addons: [...line.addons],
        quantity: line.quantity,
      },
    });
  }

  // Toggles an add-on (Boba, Jelly, etc.) on or off for the in-progress drink.
  function toggleAddon(addon) {
    setAddons((current) =>
      current.includes(addon) ? current.filter((entry) => entry !== addon) : [...current, addon]
    );
  }

  // Pushes the currently selected drink + customization onto the order. Identical
  // customizations of the same drink stack into a single line with a higher quantity.
  function addSelectedToOrder() {
    if (!selectedItem) {
      window.alert('Choose a menu item first.');
      return;
    }

    const { mode, lineId, menuItem, draft } = customizationModal;
    const quantity = Math.max(1, Number(draft.quantity) || 1);
    const customizationKey = getCustomizationKey(draft);
    setOrderLines((current) => {
      const withoutEditedLine =
        mode === 'edit' ? current.filter((line) => line.id !== lineId) : current;
      const existing = withoutEditedLine.find(
        (line) => line.menuItemId === menuItem.id && line.customizationKey === customizationKey
      );

      if (existing) {
        return withoutEditedLine.map((line) =>
          line.id === existing.id ? { ...line, quantity: line.quantity + quantity } : line
        );
      }

      return [
        ...withoutEditedLine,
        {
          id: mode === 'edit' ? lineId : `${menuItem.id}-${Date.now()}`,
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: Number(menuItem.price),
          quantity,
          size: draft.size,
          temperature: draft.temperature,
          sugar: draft.sugar,
          ice: draft.ice,
          addons: [...draft.addons],
          customizationKey,
        },
      ];
    });
    setCustomizationModal(null);
  }

  function updateLineQuantity(lineId, delta) {
    setOrderLines((current) =>
      current
        .map((line) =>
          line.id === lineId ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line
        )
        .filter((line) => line.quantity > 0)
    );
  }

  function removeLine(lineId) {
    setOrderLines((current) => current.filter((line) => line.id !== lineId));
  }

  // Empties the cart and resets the customization form back to defaults.
  function clearOrder() {
    setOrderLines([]);
    setCustomizationModal(null);
    setConfirmation(null);
  }

  // Submits the cart to the backend's /orders endpoint, which inserts the order plus
  // its line items into PostgreSQL inside a transaction. Shows a confirmation on success.
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
                  onClick={() => setActiveCategory(category)}
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
                      className="menu-tile"
                      onClick={() => openAddModal(item)}
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
                      {line.size}, {line.temperature || 'Cold'}, {line.sugar}, {line.ice}
                      {line.addons.length ? ` | Add-ons: ${line.addons.join(', ')}` : ' | Add-ons: None'}
                    </p>
                  </div>
                  <div className="order-line-actions">
                    <span>{formatCurrency(line.price * line.quantity)}</span>
                    <div className="order-qty-controls">
                      <button type="button" onClick={() => updateLineQuantity(line.id, -1)}>
                        -
                      </button>
                      <button type="button" onClick={() => updateLineQuantity(line.id, 1)}>
                        +
                      </button>
                    </div>
                    <button type="button" onClick={() => openEditModal(line)}>
                      EDIT
                    </button>
                    <button type="button" onClick={() => removeLine(line.id)}>
                      REMOVE
                    </button>
                  </div>
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
        <button className="swing-secondary" onClick={clearOrder}>
          CLEAR
        </button>
      </div>

      {customizationModal ? (
        <div className="cashier-modal-backdrop" onClick={() => setCustomizationModal(null)}>
          <div className="cashier-modal swing-panel" onClick={(event) => event.stopPropagation()}>
            <div className="cashier-modal-header">
              <div>
                <strong>{modalItem.name}</strong>
                <p>{formatCurrency(modalItem.price)}</p>
              </div>
              <button type="button" onClick={() => setCustomizationModal(null)}>
                CLOSE
              </button>
            </div>

            <div className="cashier-modal-grid">
              <label className="swing-field">
                <span>Size</span>
                <select
                  value={modalDraft.size}
                  onChange={(event) => updateModalDraft({ size: event.target.value })}
                >
                  {sizes.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
              </label>
              <label className="swing-field">
                <span>Sugar</span>
                <select
                  value={modalDraft.sugar}
                  onChange={(event) => updateModalDraft({ sugar: event.target.value })}
                >
                  {sugarLevels.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
              </label>
              <label className="swing-field">
                <span>Temperature</span>
                <select
                  value={modalDraft.temperature}
                  onChange={(event) => updateModalDraft({ temperature: event.target.value })}
                >
                  {temperatureOptions.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
              </label>
              <label className="swing-field">
                <span>Ice</span>
                <select
                  value={modalDraft.ice}
                  onChange={(event) => updateModalDraft({ ice: event.target.value })}
                >
                  {iceLevels.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
              </label>
              <label className="swing-field">
                <span>Quantity</span>
                <input
                  min="1"
                  type="number"
                  value={modalDraft.quantity}
                  onChange={(event) => updateModalDraft({ quantity: event.target.value })}
                />
              </label>
            </div>

            <div className="cashier-modal-addons">
              {addOnOptions.map((addon) => (
                <label key={addon} className="addon-option">
                  <input
                    type="checkbox"
                    checked={modalDraft.addons.includes(addon)}
                    onChange={() => toggleModalAddon(addon)}
                  />
                  <span>{addon}</span>
                </label>
              ))}
            </div>

            <button type="button" className="swing-primary cashier-modal-submit" onClick={saveCustomization}>
              {customizationModal.mode === 'edit' ? 'SAVE CHANGES' : 'ADD TO ORDER'} -{' '}
              {formatCurrency(modalLineTotal)}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

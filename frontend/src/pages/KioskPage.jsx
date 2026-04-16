import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { logoutUser } from '../utils/session.js';
import { getMenuImage } from '../utils/menuImages.js';

function useKioskBodyFlag(started, hasConfirmation) {
  useEffect(() => {
    const active = started && !hasConfirmation;
    if (active) {
      document.body.dataset.page = 'kiosk';
    }
    return () => {
      if (document.body.dataset.page === 'kiosk') {
        delete document.body.dataset.page;
      }
    };
  }, [started, hasConfirmation]);
}

const categoryNames = ['Milk Tea', 'Fruit Tea', 'Slush', 'Specialty'];
const sizeOptions = ['Small', 'Medium', 'Large'];
const sweetnessOptions = ['0%', '25%', '50%', '75%', '100%'];
const iceOptions = ['0%', '25%', '50%', '75%', '100%'];
const toppingOptions = ['Boba', 'Jelly', 'Cheese Foam', 'Lychee Popping'];

const DEFAULT_CUSTOMIZATION = {
  size: 'Medium',
  sweetness: '100%',
  ice: '100%',
  toppings: [],
};

function inferCategory(name = '') {
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

function customizationSummary(custom) {
  const parts = [custom.size, `Sweet ${custom.sweetness}`, `Ice ${custom.ice}`];
  if (custom.toppings.length) {
    parts.push(custom.toppings.join(' + '));
  }
  return parts.join(' · ');
}

export default function KioskPage() {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Milk Tea');
  const [cart, setCart] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customizingItem, setCustomizingItem] = useState(null);
  const [draftCustomization, setDraftCustomization] = useState(DEFAULT_CUSTOMIZATION);

  useKioskBodyFlag(started, Boolean(confirmation));

  useEffect(() => {
    api
      .get('/menu')
      .then((data) =>
        setMenuItems(
          data.items
            .filter((item) => item.availability)
            .map((item) => ({ ...item, category: inferCategory(item.name) }))
        )
      )
      .catch((err) => setError(err.message));
  }, []);

  const visibleItems = useMemo(() => {
    const filtered = menuItems.filter((item) => item.category === activeCategory);
    return [...filtered.slice(0, 12)];
  }, [activeCategory, menuItems]);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function openCustomization(item) {
    setCustomizingItem(item);
    setDraftCustomization(DEFAULT_CUSTOMIZATION);
  }

  function toggleTopping(topping) {
    setDraftCustomization((current) => ({
      ...current,
      toppings: current.toppings.includes(topping)
        ? current.toppings.filter((entry) => entry !== topping)
        : [...current.toppings, topping],
    }));
  }

  function confirmAddToCart() {
    if (!customizingItem) {
      return;
    }

    const key = JSON.stringify({
      size: draftCustomization.size,
      sweetness: draftCustomization.sweetness,
      ice: draftCustomization.ice,
      toppings: [...draftCustomization.toppings].sort(),
    });

    setCart((current) => {
      const existing = current.find(
        (line) => line.id === customizingItem.id && line.customKey === key
      );
      if (existing) {
        return current.map((line) =>
          line === existing ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...current,
        {
          id: customizingItem.id,
          name: customizingItem.name,
          price: Number(customizingItem.price),
          quantity: 1,
          customKey: key,
          customization: draftCustomization,
        },
      ];
    });

    setCustomizingItem(null);
    setDraftCustomization(DEFAULT_CUSTOMIZATION);
  }

  function updateQuantity(customKey, id, delta) {
    setCart((current) =>
      current
        .map((line) =>
          line.id === id && line.customKey === customKey
            ? { ...line, quantity: Math.max(0, line.quantity + delta) }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
  }

  async function checkout() {
    if (!cart.length) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const grouped = new Map();
      for (const line of cart) {
        grouped.set(line.id, (grouped.get(line.id) || 0) + line.quantity);
      }

      const result = await api.post('/orders', {
        source: 'kiosk',
        paymentMethod: 'CARD',
        items: [...grouped.entries()].map(([menuItemId, quantity]) => ({
          menuItemId,
          quantity,
        })),
      });

      setConfirmation(result.order);
      setCart([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetKiosk() {
    setStarted(false);
    setCart([]);
    setConfirmation(null);
    setActiveCategory('Milk Tea');
    setCustomizingItem(null);
  }

  if (!started) {
    return (
      <section id="page-kiosk" className="page active kiosk-page">
        <div className="kiosk-start panel">
          <div className="page-action-row page-action-row-right">
            <button onClick={() => logoutUser(navigate)}>LOGOUT</button>
          </div>
          <h1>BUBBLE TEA SELF ORDER</h1>
          <p>Touch the screen to start your order.</p>
          <button className="primary bold kiosk-start-button" onClick={() => setStarted(true)}>
            START ORDER
          </button>
        </div>
      </section>
    );
  }

  if (confirmation) {
    return (
      <section id="page-kiosk" className="page active kiosk-page">
        <div className="kiosk-confirm panel">
          <div className="page-action-row page-action-row-right">
            <button onClick={() => logoutUser(navigate)}>LOGOUT</button>
          </div>
          <div className="confirm-check">&#10003;</div>
          <h1>ORDER SUBMITTED</h1>
          <p>Order #{confirmation.id}</p>
          <p>Total: {formatCurrency(confirmation.totalAmount)}</p>
          <button className="primary bold kiosk-start-button" onClick={resetKiosk}>
            NEW CUSTOMER
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="page-kiosk" className="page active kiosk-page kiosk-active">
      <div className="cashier-header kiosk-header">
        <h2>KIOSK — SELF ORDERING</h2>
        <div className="kiosk-header-actions">
          <button onClick={resetKiosk}>RESET</button>
          <button onClick={() => logoutUser(navigate)}>LOGOUT</button>
        </div>
      </div>

      {error ? <div className="kiosk-error">{error}</div> : null}

      <div className="cashier-body kiosk-body">
        <div className="cashier-left">
          <fieldset className="panel">
            <legend>Categories</legend>
            <div className="cat-row kiosk-cat-row">
              {categoryNames.map((category) => (
                <button
                  key={category}
                  className={category === activeCategory ? 'active bold' : 'bold'}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="panel kiosk-menu-panel">
            <legend>Menu Items</legend>
            <div className="kiosk-menu-grid">
              {visibleItems.map((item) => {
                const imageSrc = getMenuImage(item.name);
                return (
                  <button
                    key={item.id}
                    className="kiosk-menu-btn"
                    onClick={() => openCustomization(item)}
                  >
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={item.name}
                        className="kiosk-menu-image"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <span>{item.name}</span>
                    <strong>{formatCurrency(item.price)}</strong>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="cashier-right kiosk-right">
          <div className="order-panel kiosk-order-panel">
            <div className="order-panel-title">Your Cart</div>
            <div className="kiosk-cart-list">
              {cart.length ? (
                cart.map((item) => (
                  <div className="kiosk-cart-row" key={`${item.id}-${item.customKey}`}>
                    <div className="kiosk-cart-info">
                      <strong>{item.name}</strong>
                      <div className="kiosk-cart-custom">
                        {customizationSummary(item.customization)}
                      </div>
                      <div>{formatCurrency(item.price)}</div>
                    </div>
                    <div className="kiosk-qty-controls">
                      <button onClick={() => updateQuantity(item.customKey, item.id, -1)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.customKey, item.id, 1)}>+</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="helper-text">Your cart is empty.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="kiosk-checkout-bar">
        <div className="kiosk-checkout-summary">
          <span>Items: {cart.reduce((sum, line) => sum + line.quantity, 0)}</span>
          <strong>TOTAL: {formatCurrency(total)}</strong>
        </div>
        <button
          className="primary bold kiosk-checkout-button"
          disabled={!cart.length || submitting}
          onClick={checkout}
        >
          {submitting ? 'PROCESSING...' : 'CHECKOUT'}
        </button>
      </div>

      {customizingItem ? (
        <div className="kiosk-modal-backdrop" onClick={() => setCustomizingItem(null)}>
          <div className="kiosk-modal panel" onClick={(e) => e.stopPropagation()}>
            <div className="kiosk-modal-header">
              <div>
                <strong>{customizingItem.name}</strong>
                <p>{formatCurrency(customizingItem.price)}</p>
              </div>
              <button type="button" onClick={() => setCustomizingItem(null)}>
                Close
              </button>
            </div>

            <div className="kiosk-modal-field">
              <span>Size</span>
              <div className="kiosk-modal-options">
                {sizeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={draftCustomization.size === option ? 'active bold' : 'bold'}
                    onClick={() =>
                      setDraftCustomization((current) => ({ ...current, size: option }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="kiosk-modal-field">
              <span>Sweetness</span>
              <div className="kiosk-modal-options">
                {sweetnessOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={draftCustomization.sweetness === option ? 'active bold' : 'bold'}
                    onClick={() =>
                      setDraftCustomization((current) => ({ ...current, sweetness: option }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="kiosk-modal-field">
              <span>Ice</span>
              <div className="kiosk-modal-options">
                {iceOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={draftCustomization.ice === option ? 'active bold' : 'bold'}
                    onClick={() =>
                      setDraftCustomization((current) => ({ ...current, ice: option }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="kiosk-modal-field">
              <span>Toppings</span>
              <div className="kiosk-modal-options">
                {toppingOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      draftCustomization.toppings.includes(option) ? 'active bold' : 'bold'
                    }
                    onClick={() => toggleTopping(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="primary bold kiosk-modal-confirm"
              onClick={confirmAddToCart}
            >
              ADD TO CART · {formatCurrency(customizingItem.price)}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

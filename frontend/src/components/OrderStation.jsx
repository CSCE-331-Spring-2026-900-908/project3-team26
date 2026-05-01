// OrderStation: shared order-building UI used by the simpler kiosk/cashier flows.
// Loads the menu, lets the user add items to a cart, and submits the cart to /orders.
// The `source` prop ("kiosk" or "cashier") tags the order on the backend so reports
// can split kiosk vs cashier sales.
// The newer full pages implement their own customizers, but this remains a compact fallback.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import MenuCard from './MenuCard.jsx';
import CartPanel from './CartPanel.jsx';

// Loads the menu from the backend on mount and exposes it to the component.
function useMenu() {
  const [menu, setMenu] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/menu')
      .then((data) => setMenu(data.items.filter((item) => item.availability)))
      .catch((err) => setError(err.message));
  }, []);

  return { menu, error };
}

// Top-level order-building component rendering the menu, category tabs, and cart panel.
// Wires together menu data, cart state, payment method, and order submission in one flow.
export default function OrderStation({
  title,
  subtitle,
  source,
  employeeId,
  kioskMode = false,
}) {
  const { menu, error } = useMenu();
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const categories = useMemo(
    () => ['All', ...new Set(menu.map((item) => item.category))],
    [menu]
  );

  const filteredMenu = useMemo(() => {
    if (activeCategory === 'All') {
      return menu;
    }
    return menu.filter((item) => item.category === activeCategory);
  }, [activeCategory, menu]);

  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);

  // Adds an item to the cart, or bumps its quantity if it's already there.
  function addToCart(item) {
    setCart((current) => {
      const existing = current.find((line) => line.id === item.id);
      if (existing) {
        return current.map((line) =>
          line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  // Increments or decrements a line. Lines that hit zero are removed from the cart.
  function updateQuantity(id, delta) {
    setCart((current) =>
      current
        .map((line) =>
          line.id === id ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line
        )
        .filter((line) => line.quantity > 0)
    );
  }

  // POSTs the cart to the backend's /orders endpoint and stores the saved order
  // for the confirmation screen. cashierId is only sent when source === 'cashier'.
  async function submitOrder() {
    setLoading(true);
    try {
      const payload = {
        items: cart.map((line) => ({
          menuItemId: line.id,
          quantity: line.quantity,
        })),
        cashierId: source === 'cashier' ? Number(employeeId || 2) : null,
        source,
        paymentMethod,
      };

      const data = await api.post('/orders', payload);
      setConfirmation(data.order);
      setCart([]);
      setPaymentMethod('CASH');
    } catch (err) {
      window.alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Clears the confirmation screen and empties the cart to restart the ordering flow.
  // Called after a successful order submission when the user wants to place another order.
  function resetFlow() {
    setConfirmation(null);
    setCart([]);
  }

  if (confirmation) {
    return (
      <section className={`confirmation-card ${kioskMode ? 'kiosk-confirmation' : ''}`}>
        <p className="eyebrow">Order Confirmed</p>
        <h1>Order #{confirmation.id}</h1>
        <p>
          {confirmation.source === 'kiosk' ? 'Kiosk' : 'Cashier'} order saved successfully with a
          total of ${confirmation.totalAmount.toFixed(2)}.
        </p>
        <div className="confirmation-lines">
          {confirmation.items.map((item) => (
            <div key={item.menuItemId}>
              {item.quantity} x {item.name}
            </div>
          ))}
        </div>
        <button className="action-button large" onClick={resetFlow}>
          {kioskMode ? 'Start New Customer Order' : 'Create Another Order'}
        </button>
      </section>
    );
  }

  return (
    <section className={kioskMode ? 'kiosk-station' : 'order-station'}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{source === 'kiosk' ? 'Self Ordering' : 'Cashier POS'}</p>
          <h1>{title}</h1>
        </div>
        <p className="page-copy">{subtitle}</p>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="category-row">
        {categories.map((category) => (
          <button
            key={category}
            className={category === activeCategory ? 'chip active' : 'chip'}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="station-layout">
        <div className="menu-grid">
          {filteredMenu.map((item) => (
            <MenuCard key={item.id} item={item} onAdd={addToCart} compact={kioskMode} />
          ))}
        </div>
        <CartPanel
          cart={cart}
          total={total}
          onIncrement={(id) => updateQuantity(id, 1)}
          onDecrement={(id) => updateQuantity(id, -1)}
          onRemove={(id) => setCart((current) => current.filter((line) => line.id !== id))}
          onSubmit={submitOrder}
          title={kioskMode ? 'Your Cart' : 'Current Order'}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          loading={loading}
        />
      </div>
    </section>
  );
}

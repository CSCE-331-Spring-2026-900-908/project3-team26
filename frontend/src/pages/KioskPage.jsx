import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { logoutUser } from '../utils/session.js';

const categoryNames = ['Milk Tea', 'Fruit Tea', 'Slush', 'Specialty'];
const allIngredientsValue = 'all';
const allIngredientsLabel = 'All Ingredients';
const hiddenIngredientFilters = new Set(['Ice']);
const specialFilterOptions = [
  { value: 'special:dairy-free', label: 'Dairy-free' },
  { value: 'special:caffeine-free', label: 'Caffeine-free' },
  { value: 'special:nut-free', label: 'Nut-free' },
  { value: 'special:contains-milk', label: 'Contains milk' },
  { value: 'special:contains-toppings', label: 'Contains toppings' },
];
const milkTerms = ['milk'];
const caffeineTerms = ['black tea', 'green tea', 'oolong tea', 'matcha powder', 'coffee'];
const nutTerms = ['nuts', 'almond', 'peanut', 'cashew', 'hazelnut', 'walnut', 'pecan', 'pistachio'];
const toppingTerms = ['tapioca pearls'];

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

function includesAnyIngredient(item, terms) {
  const ingredients = (item.ingredients || []).map((ingredient) => ingredient.toLowerCase());
  const normalizedName = item.name.toLowerCase();

  return terms.some(
    (term) =>
      ingredients.some((ingredient) => ingredient.includes(term)) || normalizedName.includes(term)
  );
}

function matchesSpecialFilter(item, filterValue) {
  switch (filterValue) {
    case 'special:dairy-free':
      return !includesAnyIngredient(item, milkTerms);
    case 'special:caffeine-free':
      return !includesAnyIngredient(item, caffeineTerms);
    case 'special:nut-free':
      return !includesAnyIngredient(item, nutTerms);
    case 'special:contains-milk':
      return includesAnyIngredient(item, milkTerms);
    case 'special:contains-toppings':
      return includesAnyIngredient(item, toppingTerms);
    default:
      return true;
  }
}

export default function KioskPage() {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Milk Tea');
  const [activeFilterValue, setActiveFilterValue] = useState(allIngredientsValue);
  const [activeMaxPrice, setActiveMaxPrice] = useState(0);
  const [cart, setCart] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const filterOptions = useMemo(() => {
    const matchingItems = menuItems.filter((item) => item.category === activeCategory);
    const ingredients = [
      ...new Set(
        matchingItems
          .flatMap((item) => item.ingredients || [])
          .filter((ingredient) => !hiddenIngredientFilters.has(ingredient))
      ),
    ];

    return [
      { value: allIngredientsValue, label: allIngredientsLabel },
      ...specialFilterOptions,
      ...ingredients.map((ingredient) => ({
        value: `ingredient:${ingredient}`,
        label: ingredient,
      })),
    ];
  }, [activeCategory, menuItems]);

  const baseFilteredItems = useMemo(
    () =>
      menuItems.filter((item) => {
        if (item.category !== activeCategory) {
          return false;
        }

        if (activeFilterValue === allIngredientsValue) {
          return true;
        }

        if (activeFilterValue.startsWith('special:')) {
          return matchesSpecialFilter(item, activeFilterValue);
        }

        if (activeFilterValue.startsWith('ingredient:')) {
          const ingredient = activeFilterValue.replace('ingredient:', '');
          return item.ingredients?.includes(ingredient);
        }

        return true;
      }),
    [activeCategory, activeFilterValue, menuItems]
  );

  const minPriceLimit = useMemo(() => {
    if (!baseFilteredItems.length) {
      return 0;
    }

    return baseFilteredItems.reduce(
      (minPrice, item) => Math.min(minPrice, Number(item.price || 0)),
      Number.POSITIVE_INFINITY
    );
  }, [baseFilteredItems]);

  const maxPriceLimit = useMemo(
    () =>
      baseFilteredItems.reduce(
        (maxPrice, item) => Math.max(maxPrice, Number(item.price || 0)),
        0
      ),
    [baseFilteredItems]
  );

  useEffect(() => {
    if (!filterOptions.some((option) => option.value === activeFilterValue)) {
      setActiveFilterValue(allIngredientsValue);
    }
  }, [activeFilterValue, filterOptions]);

  useEffect(() => {
    setActiveMaxPrice(maxPriceLimit);
  }, [minPriceLimit, maxPriceLimit]);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const sliderValue = baseFilteredItems.length
    ? Math.min(Math.max(activeMaxPrice, minPriceLimit), maxPriceLimit)
    : 0;
  const activeFilterLabel =
    filterOptions.find((option) => option.value === activeFilterValue)?.label ||
    allIngredientsLabel;
  const visibleItems = useMemo(
    () =>
      baseFilteredItems
        .filter((item) => Number(item.price || 0) <= sliderValue)
        .slice(0, 12),
    [baseFilteredItems, sliderValue]
  );

  function addItem(item) {
    setCart((current) => {
      const existing = current.find((line) => line.id === item.id);
      if (existing) {
        return current.map((line) =>
          line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, { id: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
    });
  }

  function updateQuantity(id, delta) {
    setCart((current) =>
      current
        .map((line) =>
          line.id === id ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line
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
      const result = await api.post('/orders', {
        source: 'kiosk',
        paymentMethod: 'CARD',
        items: cart.map((line) => ({
          menuItemId: line.id,
          quantity: line.quantity,
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
    setActiveFilterValue(allIngredientsValue);
    setActiveMaxPrice(0);
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
              {visibleItems.map((item) => (
                <button key={item.id} className="kiosk-menu-btn" onClick={() => addItem(item)}>
                  <span>{item.name}</span>
                  <strong>{formatCurrency(item.price)}</strong>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="cashier-right kiosk-right">
          <div className="order-panel kiosk-order-panel">
            <div className="order-panel-title">Your Cart</div>
            <div className="kiosk-cart-list">
              {cart.length ? (
                cart.map((item) => (
                  <div className="kiosk-cart-row" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <div>{formatCurrency(item.price)}</div>
                    </div>
                    <div className="kiosk-qty-controls">
                      <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="helper-text">Your cart is empty.</div>
              )}
            </div>
            <div className="order-footer">
              <div className="order-total">TOTAL: {formatCurrency(total)}</div>
              <button className="primary bold kiosk-checkout-button" disabled={!cart.length || submitting} onClick={checkout}>
                {submitting ? 'PROCESSING...' : 'CHECKOUT'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

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
const allIngredientsValue = 'all';
const allIngredientsLabel = 'All Ingredients';
const hiddenIngredientFilters = new Set(['Ice']);
const allowedIngredientFilters = new Set(['Nuts']);
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

  const filterOptions = useMemo(() => {
    const matchingItems = menuItems.filter((item) => item.category === activeCategory);
    const ingredients = [
      ...new Set(
        matchingItems
          .flatMap((item) => item.ingredients || [])
          .filter(
            (ingredient) =>
              !hiddenIngredientFilters.has(ingredient) &&
              allowedIngredientFilters.has(ingredient)
          )
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

  const sliderValue = baseFilteredItems.length
    ? Math.min(Math.max(activeMaxPrice, minPriceLimit), maxPriceLimit)
    : 0;

  const activeFilterLabel =
    filterOptions.find((option) => option.value === activeFilterValue)?.label ||
    allIngredientsLabel;

  const visibleItems = useMemo(
    () =>
      baseFilteredItems.filter((item) => Number(item.price || 0) <= sliderValue),
    [baseFilteredItems, sliderValue]
  );

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
    setActiveFilterValue(allIngredientsValue);
    setActiveMaxPrice(0);
    setCustomizingItem(null);
    setDraftCustomization(DEFAULT_CUSTOMIZATION);
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
        <div className="kiosk-banner">
          <div className="kiosk-banner-row">
            <h2>KIOSK - SELF ORDERING</h2>
            <div className="kiosk-header-actions">
              <button onClick={resetKiosk}>RESET</button>
              <button onClick={() => logoutUser(navigate)}>LOGOUT</button>
            </div>
          </div>
          <div className="kiosk-banner-row kiosk-banner-row-filter">
            <div className="kiosk-filter-group">
              <label className="kiosk-filter-label" htmlFor="ingredient-filter">
                Ingredient Filter
              </label>
              <select
                id="ingredient-filter"
                value={activeFilterValue}
                onChange={(event) => setActiveFilterValue(event.target.value)}
              >
                {filterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="kiosk-filter-group kiosk-filter-group-slider">
              <label className="kiosk-filter-label" htmlFor="price-filter">
                Max Price
              </label>
              <input
                id="price-filter"
                className="kiosk-price-slider"
                type="range"
                min={minPriceLimit}
                max={maxPriceLimit}
                step="0.01"
                value={sliderValue}
                disabled={!baseFilteredItems.length}
                onChange={(event) => setActiveMaxPrice(Number(event.target.value))}
              />
              <span className="kiosk-price-value">{formatCurrency(sliderValue)}</span>
            </div>
            <span className="helper-text kiosk-filter-summary">
              Showing {visibleItems.length} item{visibleItems.length === 1 ? '' : 's'} in{' '}
              {activeCategory} for {activeFilterLabel} from {formatCurrency(minPriceLimit)} to{' '}
              {formatCurrency(sliderValue)}
            </span>
          </div>
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
              {visibleItems.length ? (
                visibleItems.map((item) => {
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
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <span>{item.name}</span>
                      <strong>{formatCurrency(item.price)}</strong>
                    </button>
                  );
                })
              ) : (
                <div className="kiosk-empty-state helper-text">
                  No drinks in this category match the selected ingredient filter and price range.
                </div>
              )}
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
            <div className="order-footer">
              <div className="order-total">TOTAL: {formatCurrency(total)}</div>
              <button
                className="primary bold kiosk-checkout-button"
                disabled={!cart.length || submitting}
                onClick={checkout}
              >
                {submitting ? 'PROCESSING...' : 'CHECKOUT'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {customizingItem ? (
        <div className="kiosk-modal-backdrop" onClick={() => setCustomizingItem(null)}>
          <div className="kiosk-modal panel" onClick={(event) => event.stopPropagation()}>
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
              ADD TO CART - {formatCurrency(customizingItem.price)}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// KioskPage: customer-facing self-order screen at "/kiosk".
// Loads the menu via api.get('/menu'), lets the customer filter by category / ingredient / price,
// customize a drink (size, sweetness, ice, toppings) in a modal, then checkout — which POSTs the
// cart to /orders and shows a confirmation screen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { logoutUser } from '../utils/session.js';
// import { getMenuImage } from '../utils/menuImages.js';
import { getMenuImage, knownMenuItemNames } from '../utils/menuImages.js';
import { categoryNames, normalizeMenuItem } from '../utils/menuCategories.js';
import { TOPPING_PRICES, toppingOptions } from '../utils/toppings.js';
import WeatherWidget from '../components/WeatherWidget.jsx';

// Tags <body> with data-page="kiosk" while the kiosk is active so kiosk-specific CSS can apply
// (e.g., repositioning the accessibility/chat buttons). Cleans up on unmount.
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

const allIngredientsValue = 'all';
const allIngredientsLabel = 'All Ingredients';
const specialFilterOptions = [
  { value: 'special:dairy-free', label: 'Dairy-free' },
  { value: 'special:caffeine-free', label: 'Caffeine-free' },
  { value: 'special:nut-free', label: 'Nut-free' },
  { value: 'special:contains-milk', label: 'Contains milk' },
];
const milkTerms = ['milk'];
const caffeineTerms = ['black tea', 'green tea', 'oolong tea', 'matcha powder', 'coffee'];
const nutTerms = ['nuts', 'almond', 'peanut', 'cashew', 'hazelnut', 'walnut', 'pecan', 'pistachio'];
const sizeOptions = ['Small', 'Medium', 'Large'];
const temperatureOptions = ['Cold', 'Hot'];
const sweetnessOptions = ['0%', '25%', '50%', '75%', '100%', '125%', '150%'];
const iceOptions = ['0%', '25%', '50%', '75%', '100%', '125%', '150%'];
const KIOSK_THEMES = {
  hue: {
    className: 'kiosk-theme-hue',
    label: 'HUE',
    nextLabel: 'CLASSIC',
  },
  classic: {
    className: 'kiosk-theme-classic',
    label: 'CLASSIC',
    nextLabel: 'HUE',
  },
};
const DEFAULT_MAX_PRICE = Number.POSITIVE_INFINITY;

const DEFAULT_CUSTOMIZATION = {
  size: 'Medium',
  temperature: 'Cold',
  sweetness: '100%',
  ice: '100%',
  toppings: [],
};

// Price modifiers applied on top of the menu item's base price. Sizes shift up/down,
// toppings add a flat fee. Backend mirrors this logic so totals are recomputed server-side.
const SIZE_PRICE_DELTA = { Small: -1.10, Medium: 0, Large: 1.10 };
// Texas state sales tax (6.25%) plus typical College Station local rate (2.0%) = 8.25%.
// Backend mirrors this so the total stored in the database matches what the customer sees.
const TEXAS_TAX_RATE = 0.0825;

function roundCurrency(value) {
  return Math.round(Number(value) * 100) / 100;
}

// Computes the per-line price for a customized drink: base + size delta + sum(topping prices).
function computeItemPrice(basePrice, customization) {
  const sizeDelta = SIZE_PRICE_DELTA[customization?.size] ?? 0;
  const toppingsTotal = (customization?.toppings || []).reduce(
    (sum, topping) => sum + (TOPPING_PRICES[topping] || 0),
    0
  );
  return Number((Number(basePrice || 0) + sizeDelta + toppingsTotal).toFixed(2));
}

// Drinks that should appear under "Specialty" even though their name matches another category's keywords.
const SPECIALTY_OVERRIDES = new Set([
  'creme brulee milk tea',
]);

// Converts a lowercase imageMap key ('classic milk tea') into a display name.
function toTitleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Buckets a drink into one of the four kiosk categories based on keywords in its name.
function inferCategory(name = '') {
  const normalized = name.toLowerCase().trim();
  if (SPECIALTY_OVERRIDES.has(normalized)) {
    return 'Specialty';
  }
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

// Placeholder items built entirely from the local imageMap — no network call needed.
// They render images and names instantly on first visit, with _isPlaceholder: true
// so the render logic can show "Loading..." instead of a real price.
const STATIC_SEED = knownMenuItemNames.map((key) => ({
  id: `seed-${key}`,
  name: toTitleCase(key),
  price: 0,
  availability: true,
  category: inferCategory(key),
  ingredients: [],
  _isPlaceholder: true,
}));

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

// Builds the human-readable line shown under each cart item (e.g. "Medium · Cold · Sweet 75% · Ice 100% · Boba").
function customizationSummary(custom) {
  const parts = [
    custom.size,
    custom.temperature || 'Cold',
    `Sweet ${custom.sweetness}`,
    `Ice ${custom.ice}`,
  ];
  if (custom.toppings.length) {
    parts.push(custom.toppings.join(' + '));
  }
  return parts.join(' · ');
}

// Returns true if any of the search terms appears in the drink's ingredient list or name.
// Used by the dietary filters below.
function includesAnyIngredient(item, terms) {
  const ingredients = (item.ingredients || []).map((ingredient) => ingredient.toLowerCase());
  const normalizedName = item.name.toLowerCase();

  return terms.some(
    (term) =>
      ingredients.some((ingredient) => ingredient.includes(term)) || normalizedName.includes(term)
  );
}

// Maps the dropdown's "special:*" filter values to the actual ingredient checks.
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
    default:
      return true;
  }
}

export default function KioskPage() {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  // const [menuItems, setMenuItems] = useState([]);
  const [menuItems, setMenuItems] = useState(STATIC_SEED);
  const [activeCategory, setActiveCategory] = useState('Milk Tea');
  const [activeFilterValue, setActiveFilterValue] = useState(allIngredientsValue);
  const [activeMaxPrice, setActiveMaxPrice] = useState(DEFAULT_MAX_PRICE);
  const [cart, setCart] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');
  const [kioskTheme, setKioskTheme] = useState('hue');
  const [submitting, setSubmitting] = useState(false);
  const [customizingItem, setCustomizingItem] = useState(null);
  const [editingLine, setEditingLine] = useState(null);
  const [draftCustomization, setDraftCustomization] = useState(DEFAULT_CUSTOMIZATION);
  const [ingredientFilterOpen, setIngredientFilterOpen] = useState(false);
  const [hoveredFilterValue, setHoveredFilterValue] = useState('');
  // Drives the checkout flow: null = normal cart view, 'confirm' = "Continue?" popup,
  // 'payment' = full-screen Cash/Card picker. After a successful submit, `confirmation`
  // takes over and shows the receipt with the tax breakdown.
  const [checkoutStep, setCheckoutStep] = useState(null);
  const kioskHeaderRef = useRef(null);
  const kioskCategoriesRef = useRef(null);
  const ingredientFilterRef = useRef(null);
  const [kioskFixedHeights, setKioskFixedHeights] = useState({
    header: 0,
    categories: 0,
  });

  // True only once real items (with real prices) have replaced the seed.
  const menuLoaded = menuItems.length > 0 && !menuItems[0]?._isPlaceholder;
  const activeTheme = KIOSK_THEMES[kioskTheme] || KIOSK_THEMES.hue;
  const kioskPageClassName = `page active kiosk-page ${activeTheme.className}`;

  useKioskBodyFlag(started, Boolean(confirmation));

  useEffect(() => {
    document.body.dataset.kioskTheme = kioskTheme;

    return () => {
      if (document.body.dataset.kioskTheme === kioskTheme) {
        delete document.body.dataset.kioskTheme;
      }
    };
  }, [kioskTheme]);

  // Measures the heights of the sticky header and category bar so the menu grid below
  // them can offset itself. Re-runs on resize via ResizeObserver.
  useEffect(() => {
    if (!started || confirmation || checkoutStep === 'payment') {
      setKioskFixedHeights({ header: 0, categories: 0 });
      return undefined;
    }

    const header = kioskHeaderRef.current;
    const categories = kioskCategoriesRef.current;
    if (!header || !categories) {
      return undefined;
    }

    const updateFixedHeights = () => {
      setKioskFixedHeights({
        header: header.getBoundingClientRect().height,
        categories: categories.getBoundingClientRect().height,
      });
    };

    updateFixedHeights();
    window.addEventListener('resize', updateFixedHeights);

    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', updateFixedHeights);
    }

    const resizeObserver = new ResizeObserver(updateFixedHeights);
    resizeObserver.observe(header);
    resizeObserver.observe(categories);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateFixedHeights);
    };
  }, [started, confirmation, checkoutStep]);

  // Fetches the menu from the backend on mount. Filters to available items and
  // tags each item with its inferred category so the category buttons can filter locally.
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

  const filterOptions = useMemo(
    () => [{ value: allIngredientsValue, label: allIngredientsLabel }, ...specialFilterOptions],
    []
  );

  useEffect(() => {
    if (!ingredientFilterOpen) {
      return undefined;
    }

    const closeOnOutsideClick = (event) => {
      if (!ingredientFilterRef.current?.contains(event.target)) {
        setIngredientFilterOpen(false);
        setHoveredFilterValue('');
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setIngredientFilterOpen(false);
        setHoveredFilterValue('');
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [ingredientFilterOpen]);

  // Items that match the active category and ingredient filter. The price slider
  // narrows this further into `visibleItems` below.
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

  const sliderValue = baseFilteredItems.length
    ? Math.min(Math.max(activeMaxPrice, minPriceLimit), maxPriceLimit)
    : 0;

  const sliderFillPercent =
    maxPriceLimit > minPriceLimit
      ? ((sliderValue - minPriceLimit) / (maxPriceLimit - minPriceLimit)) * 100
      : 100;

  const activeFilterLabel =
    filterOptions.find((option) => option.value === activeFilterValue)?.label ||
    allIngredientsLabel;

  const visibleItems = useMemo(
    () =>
      baseFilteredItems.filter((item) => Number(item.price || 0) <= sliderValue),
    [baseFilteredItems, sliderValue]
  );

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Builds the stable key used to dedupe identical customizations in the cart.
  function getCustomizationKey(customization) {
    return JSON.stringify({
      size: customization.size,
      temperature: customization.temperature,
      sweetness: customization.sweetness,
      ice: customization.ice,
      toppings: [...(customization.toppings || [])].sort(),
    });
  }

  // Closes the customization modal and clears the in-progress edit/draft.
  function closeCustomization() {
    setCustomizingItem(null);
    setEditingLine(null);
    setDraftCustomization(DEFAULT_CUSTOMIZATION);
  }

  // Opens the modal for an existing cart line so the customer can edit it in place.
  function openCartEdit(line) {
    setEditingLine({ id: line.id, customKey: line.customKey });
    setCustomizingItem({
      id: line.id,
      name: line.name,
      price: line.basePrice ?? line.price,
    });
    setDraftCustomization({
      ...DEFAULT_CUSTOMIZATION,
      ...line.customization,
      toppings: [...(line.customization?.toppings || [])],
    });
  }

  // Opens the customization modal for the chosen menu item with default options.
  function openCustomization(item) {
    if (item._isPlaceholder) return; // prices not ready yet
    setEditingLine(null);
    setCustomizingItem(item);
    setDraftCustomization(DEFAULT_CUSTOMIZATION);
  }

  // Adds or removes a topping from the in-progress customization.
  function toggleTopping(topping) {
    setDraftCustomization((current) => ({
      ...current,
      toppings: current.toppings.includes(topping)
        ? current.toppings.filter((entry) => entry !== topping)
        : [...current.toppings, topping],
    }));
  }

  // Adds the customized drink to the cart. Drinks with identical customizations stack
  // into one line (quantity++); different customizations of the same drink stay separate.
  function confirmAddToCart() {
    if (!customizingItem) {
      return;
    }

    const key = getCustomizationKey(draftCustomization);
    const price = computeItemPrice(customizingItem.price, draftCustomization);
    const customization = {
      ...draftCustomization,
      toppings: [...draftCustomization.toppings],
    };

    setCart((current) => {
      if (editingLine) {
        const lineBeingEdited = current.find(
          (line) => line.id === editingLine.id && line.customKey === editingLine.customKey
        );
        if (!lineBeingEdited) {
          return current;
        }

        const remainingLines = current.filter(
          (line) => !(line.id === editingLine.id && line.customKey === editingLine.customKey)
        );
        const matchingLine = remainingLines.find(
          (line) => line.id === customizingItem.id && line.customKey === key
        );

        if (matchingLine) {
          return remainingLines.map((line) =>
            line === matchingLine
              ? { ...line, quantity: line.quantity + lineBeingEdited.quantity }
              : line
          );
        }

        return [
          ...remainingLines,
          {
            ...lineBeingEdited,
            name: customizingItem.name,
            price,
            customKey: key,
            customization,
            basePrice: customizingItem.price,
          },
        ];
      }

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
          price,
          quantity: 1,
          customKey: key,
          customization,
          basePrice: customizingItem.price,
        },
      ];
    });

    closeCustomization();
  }

  // Increments or decrements the quantity for a specific cart line. Lines that hit zero are removed.
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

  // Submits the cart to the backend's /orders endpoint with the customer's chosen payment
  // method. The backend recomputes the subtotal from menu prices, adds Texas sales tax, and
  // returns the breakdown so the receipt screen can display it.
  async function checkout(paymentMethod) {
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
        paymentMethod,
        items: [...grouped.entries()].map(([menuItemId, quantity]) => ({
          menuItemId,
          quantity,
        })),
      });

      setConfirmation(result.order);
      setCart([]);
      setCheckoutStep(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Pre-tax subtotal of everything currently in the cart.
  const cartSubtotal = roundCurrency(total);
  // Texas sales tax displayed to the customer; backend recomputes the same value before storing.
  const cartTax = roundCurrency(cartSubtotal * TEXAS_TAX_RATE);
  // Grand total including tax — what gets charged and stored as orders.total_amount.
  const cartGrandTotal = roundCurrency(cartSubtotal + cartTax);

  // Returns the kiosk to the welcome screen and clears any in-progress order/customization.
  function resetKiosk() {
    setStarted(false);
    setCart([]);
    setConfirmation(null);
    setCheckoutStep(null);
    setActiveCategory('Milk Tea');
    setActiveFilterValue(allIngredientsValue);
    setActiveMaxPrice(DEFAULT_MAX_PRICE);
    closeCustomization();
  }

  function toggleKioskTheme() {
    setKioskTheme((current) => (current === 'hue' ? 'classic' : 'hue'));
  }

  function chooseIngredientFilter(value) {
    setActiveFilterValue(value);
    setIngredientFilterOpen(false);
    setHoveredFilterValue('');
  }

  function renderThemeButton() {
    return (
      <button
        type="button"
        className="kiosk-theme-button"
        onClick={toggleKioskTheme}
        aria-label={`Switch kiosk theme to ${activeTheme.nextLabel.toLowerCase()}`}
      >
        THEME: {activeTheme.label}
      </button>
    );
  }

  if (!started) {
    return (
      <section id="page-kiosk" className={kioskPageClassName}>
        <div className="kiosk-start panel">
          <div className="page-action-row page-action-row-right">
            {renderThemeButton()}
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
    // Backend returns subtotal/tax/totalAmount; falls back to client-computed values if not.
    const receiptSubtotal =
      confirmation.subtotal != null ? Number(confirmation.subtotal) : cartSubtotal;
    const receiptTax = confirmation.tax != null ? Number(confirmation.tax) : cartTax;
    const receiptTotal = Number(confirmation.totalAmount);
    return (
      <section id="page-kiosk" className={kioskPageClassName}>
        <div className="kiosk-confirm panel">
          <div className="page-action-row page-action-row-right">
            {renderThemeButton()}
            <button onClick={() => logoutUser(navigate)}>LOGOUT</button>
          </div>
          <div className="confirm-check">&#10003;</div>
          <h1>PURCHASE CONFIRMED</h1>
          <p>Order #{confirmation.id}</p>
          <p>Paid by {confirmation.paymentMethod === 'CARD' ? 'Card' : 'Cash'}</p>
          <div className="kiosk-receipt-totals">
            <div>
              <span>Subtotal</span>
              <strong>{formatCurrency(receiptSubtotal)}</strong>
            </div>
            <div>
              <span>Sales Tax (8.25%)</span>
              <strong>{formatCurrency(receiptTax)}</strong>
            </div>
            <div className="kiosk-receipt-grand">
              <span>Total</span>
              <strong>{formatCurrency(receiptTotal)}</strong>
            </div>
          </div>
          <button className="primary bold kiosk-start-button" onClick={resetKiosk}>
            NEW CUSTOMER
          </button>
        </div>
      </section>
    );
  }

  // Full-screen payment view: customer reviews the cart and chooses Cash or Card.
  if (checkoutStep === 'payment') {
    return (
      <section id="page-kiosk" className={kioskPageClassName}>
        <div className="kiosk-confirm panel kiosk-payment-panel">
          <div className="page-action-row page-action-row-right">
            {renderThemeButton()}
            <button onClick={() => logoutUser(navigate)}>LOGOUT</button>
          </div>
          <h1>CHECKOUT</h1>
          <p>Review your order and choose a payment method.</p>
          {error ? <div className="kiosk-error">{error}</div> : null}

          <div className="kiosk-payment-cart">
            {cart.map((item) => (
              <div className="kiosk-cart-row" key={`pay-${item.id}-${item.customKey}`}>
                <div className="kiosk-cart-info">
                  <strong>
                    {item.quantity} × {item.name}
                  </strong>
                  <div className="kiosk-cart-custom">
                    {customizationSummary(item.customization)}
                  </div>
                </div>
                <strong>{formatCurrency(item.price * item.quantity)}</strong>
              </div>
            ))}
          </div>

          <div className="kiosk-receipt-totals">
            <div>
              <span>Subtotal</span>
              <strong>{formatCurrency(cartSubtotal)}</strong>
            </div>
            <div>
              <span>Sales Tax (8.25%)</span>
              <strong>{formatCurrency(cartTax)}</strong>
            </div>
            <div className="kiosk-receipt-grand">
              <span>Total</span>
              <strong>{formatCurrency(cartGrandTotal)}</strong>
            </div>
          </div>

          <div className="kiosk-payment-actions">
            <button
              type="button"
              className="primary bold kiosk-start-button"
              disabled={submitting}
              onClick={() => checkout('CASH')}
            >
              {submitting ? 'PROCESSING...' : 'PAY WITH CASH'}
            </button>
            <button
              type="button"
              className="primary bold kiosk-start-button"
              disabled={submitting}
              onClick={() => checkout('CARD')}
            >
              {submitting ? 'PROCESSING...' : 'PAY WITH CARD'}
            </button>
          </div>

          <button
            type="button"
            className="kiosk-payment-back"
            disabled={submitting}
            onClick={() => setCheckoutStep(null)}
          >
            ← Back to ordering
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      id="page-kiosk"
      className={`${kioskPageClassName} kiosk-active`}
      style={{
        '--kiosk-header-height': `${kioskFixedHeights.header}px`,
        '--kiosk-categories-height': `${kioskFixedHeights.categories}px`,
      }}
    >
      <div className="cashier-header kiosk-header" ref={kioskHeaderRef}>
        <div className="kiosk-banner">
          <div className="kiosk-banner-row">
            <div className="kiosk-brand-wordmark notranslate" translate="no" aria-label="DATS Boba">
              <span>DATS</span>
              <strong>Boba</strong>
            </div>
            <h2>KIOSK - SELF ORDERING</h2>
            <div className="kiosk-header-actions">
              <div className="kiosk-header-weather">
                <WeatherWidget />
              </div>
              {renderThemeButton()}
              <button onClick={resetKiosk}>RESET</button>
              <button onClick={() => logoutUser(navigate)}>LOGOUT</button>
            </div>
          </div>
          <div className="kiosk-banner-row kiosk-banner-row-filter">
            <div className="kiosk-filter-group">
              <label className="kiosk-filter-label" htmlFor="ingredient-filter">
                Ingredient Filter
              </label>
              <div
                className="kiosk-filter-select"
                ref={ingredientFilterRef}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIngredientFilterOpen(false);
                    setHoveredFilterValue('');
                  }
                }}
              >
                <button
                  type="button"
                  id="ingredient-filter"
                  className="kiosk-filter-select-button"
                  aria-haspopup="listbox"
                  aria-expanded={ingredientFilterOpen}
                  aria-controls="ingredient-filter-options"
                  onClick={() => setIngredientFilterOpen((open) => !open)}
                >
                  <span>{activeFilterLabel}</span>
                  <span className="kiosk-filter-select-arrow" aria-hidden="true" />
                </button>
                {ingredientFilterOpen ? (
                  <div
                    className="kiosk-filter-select-options"
                    id="ingredient-filter-options"
                    role="listbox"
                    aria-label="Ingredient filter options"
                    onPointerLeave={() => setHoveredFilterValue('')}
                  >
                    {filterOptions.map((option) => {
                      const isActive = option.value === activeFilterValue;
                      const isHovered = option.value === hoveredFilterValue;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          className={[
                            'kiosk-filter-option',
                            isActive ? 'active' : '',
                            isHovered ? 'hovered' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onPointerEnter={() => setHoveredFilterValue(option.value)}
                          onFocus={() => setHoveredFilterValue(option.value)}
                          onClick={() => chooseIngredientFilter(option.value)}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
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
                style={{ '--slider-fill': `${sliderFillPercent}%` }}
              />
              <span className="kiosk-price-value">{formatCurrency(sliderValue)}</span>
            </div>
            <span className="helper-text kiosk-filter-summary">
              {menuLoaded ? (
                <>
                  Showing {visibleItems.length} item{visibleItems.length === 1 ? '' : 's'} in{' '}
                  {activeCategory} for {activeFilterLabel} from {formatCurrency(minPriceLimit)} to{' '}
                  {formatCurrency(sliderValue)}
                </>
              ) : (
                'Menu loading...'
              )}
            </span>
          </div>
        </div>
      </div>

      {error ? <div className="kiosk-error">{error}</div> : null}

      <div className="cashier-body kiosk-body">
        <div className="cashier-left">
          <section
            className="panel kiosk-panel-section kiosk-categories-panel"
            ref={kioskCategoriesRef}
            aria-labelledby="kiosk-categories-heading"
          >
            <div className="kiosk-panel-label" id="kiosk-categories-heading">
              Categories
            </div>
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
          </section>

          <section
            className="panel kiosk-panel-section kiosk-menu-panel"
            aria-labelledby="kiosk-menu-heading"
          >
            <div className="kiosk-panel-label" id="kiosk-menu-heading">
              Menu Items
            </div>
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
                      <strong>{item._isPlaceholder ? 'Loading...' : formatCurrency(item.price)}</strong>
                    </button>
                  );
                })
              ) : (
                <div className="kiosk-empty-state helper-text">
                  No drinks in this category match the selected ingredient filter and price range.
                </div>
              )}
            </div>
          </section>
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
                    <div className="kiosk-cart-actions">
                      <button
                        type="button"
                        className="kiosk-edit-button"
                        onClick={() => openCartEdit(item)}
                      >
                        Edit
                      </button>
                      <div className="kiosk-qty-controls">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.customKey, item.id, -1)}
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.customKey, item.id, 1)}
                        >
                          +
                        </button>
                      </div>
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
                onClick={() => setCheckoutStep('confirm')}
              >
                {submitting ? 'PROCESSING...' : 'CHECKOUT'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {customizingItem ? (
        <div className="kiosk-modal-backdrop" onClick={closeCustomization}>
          <div className="kiosk-modal panel" onClick={(event) => event.stopPropagation()}>
            <div className="kiosk-modal-header">
              <div>
                <strong>{customizingItem.name}</strong>
                <p>{formatCurrency(customizingItem.price)}</p>
              </div>
              <button type="button" onClick={closeCustomization}>
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
              <span>Temperature</span>
              <div className="kiosk-modal-options">
                {temperatureOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={draftCustomization.temperature === option ? 'active bold' : 'bold'}
                    onClick={() =>
                      setDraftCustomization((current) => ({ ...current, temperature: option }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="kiosk-modal-field">
              <span>Sweetness</span>
              <div className="kiosk-modal-options kiosk-modal-options-sweetness">
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
              <div className="kiosk-modal-options kiosk-modal-options-even">
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
              {editingLine ? 'SAVE CHANGES' : 'ADD TO CART'} -{' '}
              {formatCurrency(computeItemPrice(customizingItem.price, draftCustomization))}
            </button>
          </div>
        </div>
      ) : null}

      {/* "Continue to checkout?" popup. Closes silently on Return; advances to the
          payment screen on Continue. */}
      {checkoutStep === 'confirm' ? (
        <div
          className="kiosk-modal-backdrop"
          onClick={() => setCheckoutStep(null)}
        >
          <div
            className="kiosk-modal panel kiosk-checkout-confirm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="kiosk-modal-header">
              <strong>Continue to checkout?</strong>
            </div>
            <p>
              You can return to keep adding items, or continue to choose a payment method.
            </p>
            <div className="kiosk-modal-options kiosk-checkout-confirm-actions">
              <button type="button" className="bold" onClick={() => setCheckoutStep(null)}>
                RETURN TO ORDERING
              </button>
              <button
                type="button"
                className="primary bold"
                onClick={() => setCheckoutStep('payment')}
              >
                CONTINUE TO CHECKOUT
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

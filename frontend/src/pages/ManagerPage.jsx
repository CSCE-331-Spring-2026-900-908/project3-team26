// ManagerPage: manager-only dashboard at "/manager". Six sections (Dashboard, Orders,
// Inventory, Menu, Employees, Reports), each backed by an API endpoint under /manager/*.
// All forms (inventory create/update, menu CRUD, employee CRUD, void order) round-trip to
// the backend and re-fetch the page data so the UI stays in sync with PostgreSQL.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import InventoryTable from '../components/InventoryTable.jsx';
import { logoutUser } from '../utils/session.js';

const sections = ['DASHBOARD', 'ORDERS', 'INVENTORY', 'MENU', 'EMPLOYEES', 'REPORTS'];

const initialInventoryForm = { name: '', unit: 'oz', quantity: '0', threshold: '0' };
const initialInventoryUpdate = { ingredientId: '', delta: '', threshold: '' };
const initialInventoryEdit = { name: '', unit: '', quantity: '', threshold: '', availability: true };
const initialMenuForm = { id: '', name: '', price: '', ingredientIds: '', availability: true };
const initialMenuEdit = { name: '', price: '', ingredientIds: '', availability: true };
const initialEmployeeForm = { id: '', permission: 'Cashier', actions: '', changes: '' };
const employeePermissionOptions = ['Cashier', 'Manager'];

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatChartCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(Number(value || 0)) >= 10000 ? 'compact' : 'standard',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function formatNumber(value, options = {}) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    ...options,
  }).format(Number(value || 0));
}

function formatHourLabel(value) {
  const hour = Number(value);
  if (!Number.isFinite(hour)) {
    return String(value || '-');
  }
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12} ${suffix}`;
}

function parseIdList(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
}

function formatShortDate(value) {
  if (!value) {
    return '-';
  }
  if (typeof value === 'string') {
    const match = value.match(/\d{4}-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  }
  return new Date(value).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
}

function SalesTrendChart({ data = [] }) {
  const points = data.slice(-10);
  const width = 520;
  const height = 230;
  const padding = 34;
  const maxSales = Math.max(...points.map((row) => Number(row.sales || 0)), 1);
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const plotted = points.map((row, index) => {
    const x = padding + step * index;
    const y = height - padding - (Number(row.sales || 0) / maxSales) * (height - padding * 2);
    return { ...row, x, y };
  });
  const path = plotted.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="manager-chart-body manager-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily sales trend in US dollars">
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="chart-axis" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />
        {path ? <path d={path} className="chart-line" /> : null}
        {plotted.map((point) => (
          <g key={`${point.date}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r="5" className="chart-dot" />
            <text x={point.x} y={point.y - 12} className="chart-value" textAnchor="middle">
              {formatChartCurrency(point.sales)}
            </text>
            <text x={point.x} y={height - 10} className="chart-label" textAnchor="middle">
              {formatShortDate(point.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function PeakHoursChart({ data = [] }) {
  const rows = data.slice(0, 10);
  const maxOrders = Math.max(...rows.map((row) => Number(row.orderCount || 0)), 1);

  return (
    <div className="manager-chart-body manager-bar-chart-wrap">
      <div className="manager-chart-note">Sorted greatest to least by order count</div>
      <div className="manager-bar-chart" role="img" aria-label="Peak hours by order count">
        {rows.map((row) => (
          <div className="manager-bar-column" key={row.hour}>
            <div className="manager-bar-stack">
              <span className="manager-bar-value">
                {formatNumber(row.orderCount)}
                <small>orders</small>
              </span>
              <span className="manager-bar-fill" style={{ height: `${Math.max((row.orderCount / maxOrders) * 100, 3)}%` }} />
            </div>
            <span className="manager-bar-label">{formatHourLabel(row.hour)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopItemsList({ data = [] }) {
  return (
    <div className="manager-chart-body manager-top-list">
      {data.slice(0, 10).map((item) => (
        <div className="manager-top-row" key={item.name}>
          <span>{item.name}</span>
          <strong>
            {formatNumber(item.totalUnitsSold)}
            <small> sold</small>
          </strong>
        </div>
      ))}
    </div>
  );
}

function RevenueCategoryChart({ data = [] }) {
  const palette = ['#557fb0', '#d48645', '#6eaa79', '#bd5c60'];
  const total = data.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  let cursor = 0;
  const stops = data.map((row, index) => {
    const start = cursor;
    const value = total > 0 ? (Number(row.revenue || 0) / total) * 100 : 0;
    cursor += value;
    return `${palette[index % palette.length]} ${start}% ${cursor}%`;
  });

  return (
    <div className="manager-chart-body manager-pie-layout">
      <div className="manager-pie-legend">
        {data.map((row, index) => {
          const percent = total > 0 ? (Number(row.revenue || 0) / total) * 100 : 0;
          return (
            <div className="manager-legend-row" key={row.category}>
              <span style={{ background: palette[index % palette.length] }} />
              <strong>{row.category}</strong>
              <small>{percent.toFixed(1)}% revenue</small>
            </div>
          );
        })}
      </div>
      <div className="manager-pie" style={{ background: stops.length ? `conic-gradient(${stops.join(', ')})` : '#d8dce4' }} />
    </div>
  );
}

export default function ManagerPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('DASHBOARD');
  const [dashboard, setDashboard] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [orders, setOrders] = useState([]);
  const [xReport, setXReport] = useState(null);
  const [zPreview, setZPreview] = useState(null);
  const [inventoryForm, setInventoryForm] = useState(initialInventoryForm);
  const [inventoryUpdate, setInventoryUpdate] = useState(initialInventoryUpdate);
  const [editingInventoryId, setEditingInventoryId] = useState(null);
  const [inventoryEdit, setInventoryEdit] = useState(initialInventoryEdit);
  const [menuForm, setMenuForm] = useState(initialMenuForm);
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuEdit, setMenuEdit] = useState(initialMenuEdit);
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);
  const [employeePermissionOpen, setEmployeePermissionOpen] = useState(false);
  const [hoveredEmployeePermission, setHoveredEmployeePermission] = useState('');
  const [voidOrderId, setVoidOrderId] = useState('');
  const [zClosing, setZClosing] = useState(false);
  const [zReopening, setZReopening] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const employeePermissionRef = useRef(null);

  // Pulls every section's data in parallel from the backend. Called on mount and
  // again after any mutation (create, update, void) so the UI stays in sync with PostgreSQL.
  async function loadPage() {
    try {
      const [dashboardData, inventoryData, menuData, employeeData, orderData, xData, zData] =
        await Promise.all([
          api.get('/manager/dashboard'),
          api.get('/manager/inventory'),
          api.get('/manager/menu'),
          api.get('/manager/employees'),
          api.get('/manager/orders'),
          api.get('/manager/reports/x'),
          api.get('/manager/reports/z-preview'),
        ]);
      setDashboard(dashboardData);
      setInventory(inventoryData.items);
      setMenuItems(menuData.items);
      setEmployees(employeeData.employees);
      setOrders(orderData.orders);
      setXReport(xData.report);
      setZPreview(zData.report);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  function handleSectionSelect(section) {
    setActiveSection(section);
    if (section !== activeSection && ['DASHBOARD', 'ORDERS', 'INVENTORY'].includes(section)) {
      loadPage();
    }
  }

  useEffect(() => {
    if (!employeePermissionOpen) {
      return undefined;
    }

    const closeOnOutsideClick = (event) => {
      if (!employeePermissionRef.current?.contains(event.target)) {
        setEmployeePermissionOpen(false);
        setHoveredEmployeePermission('');
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setEmployeePermissionOpen(false);
        setHoveredEmployeePermission('');
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [employeePermissionOpen]);

  // POSTs a new ingredient + inventory row to /manager/inventory, then refreshes the page.
  async function handleInventoryCreate(event) {
    event.preventDefault();
    setFeedback('');
    setError('');
    try {
      await api.post('/manager/inventory', {
        ...inventoryForm,
        quantity: Number(inventoryForm.quantity),
        threshold: Number(inventoryForm.threshold),
        availability: true,
      });
      setInventoryForm(initialInventoryForm);
      setFeedback('Inventory item added.');
      await loadPage();
    } catch (err) {
      setError(err.message);
    }
  }

  // PATCHes an existing inventory row to add/remove stock or change the low-stock threshold.
  async function handleInventoryUpdate(event) {
    event.preventDefault();
    setFeedback('');
    setError('');
    try {
      await api.patch(`/manager/inventory/${inventoryUpdate.ingredientId}`, {
        delta: inventoryUpdate.delta === '' ? undefined : Number(inventoryUpdate.delta),
        threshold: inventoryUpdate.threshold === '' ? undefined : Number(inventoryUpdate.threshold),
      });
      setInventoryUpdate(initialInventoryUpdate);
      setFeedback('Inventory updated.');
      await loadPage();
    } catch (err) {
      setError(err.message);
    }
  }

  function startInventoryEdit(item) {
    const ingredientId = item.ingredientId || item.ingredient_id;
    setEditingInventoryId(ingredientId);
    setInventoryEdit({
      name: item.name || '',
      unit: item.unit || '',
      quantity: String(item.quantity ?? ''),
      threshold: String(item.threshold ?? ''),
      availability: item.availability ?? true,
    });
  }

  function updateInventoryEdit(partial) {
    setInventoryEdit((current) => ({ ...current, ...partial }));
  }

  function cancelInventoryEdit() {
    setEditingInventoryId(null);
    setInventoryEdit(initialInventoryEdit);
  }

  async function saveInventoryEdit(ingredientId) {
    setFeedback('');
    setError('');
    const quantity = Number(inventoryEdit.quantity);
    const threshold = Number(inventoryEdit.threshold);
    if (!inventoryEdit.name.trim() || !Number.isFinite(quantity) || !Number.isFinite(threshold)) {
      setError('Name, quantity, and threshold are required for inventory edits.');
      return;
    }
    try {
      await api.patch(`/manager/inventory/${ingredientId}`, {
        name: inventoryEdit.name.trim(),
        unit: inventoryEdit.unit.trim() || null,
        quantity,
        threshold,
        availability: inventoryEdit.availability,
      });
      cancelInventoryEdit();
      setFeedback('Inventory item updated.');
      await loadPage();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteInventoryItem(item) {
    const ingredientId = item.ingredientId || item.ingredient_id;
    if (!window.confirm(`Delete ${item.name} from inventory? This also removes its menu ingredient links.`)) {
      return;
    }

    setFeedback('');
    setError('');
    try {
      await api.delete(`/manager/inventory/${ingredientId}`);
      if (Number(editingInventoryId) === Number(ingredientId)) {
        cancelInventoryEdit();
      }
      setFeedback('Inventory item deleted.');
      await loadPage();
    } catch (err) {
      setError(err.message);
    }
  }

  // Creates or updates a menu item depending on whether menuForm.id was filled in.
  // POST /manager/menu for a new item, PATCH /manager/menu/:id for an edit.
  async function handleMenuSubmit(event) {
    event.preventDefault();
    setFeedback('');
    setError('');
    try {
      const hasIngredientIds = menuForm.ingredientIds.trim() !== '';
      const ingredientIds = parseIdList(menuForm.ingredientIds);

      if (menuForm.id) {
        const body = {
          name: menuForm.name || undefined,
          price: menuForm.price ? Number(menuForm.price) : undefined,
          availability: menuForm.availability,
        };
        if (hasIngredientIds) {
          body.ingredientIds = ingredientIds;
        }
        await api.patch(`/manager/menu/${menuForm.id}`, body);
      } else {
        await api.post('/manager/menu', {
          name: menuForm.name,
          price: Number(menuForm.price),
          ingredientIds,
          availability: menuForm.availability,
        });
      }
      setMenuForm(initialMenuForm);
      setFeedback('Menu saved.');
      await loadPage();
    } catch (err) {
      setError(err.message);
    }
  }

  function startMenuEdit(item) {
    setEditingMenuId(item.id);
    setMenuEdit({
      name: item.name || '',
      price: String(item.price ?? ''),
      ingredientIds: item.ingredient_ids || '',
      availability: item.availability ?? true,
    });
  }

  function updateMenuEdit(partial) {
    setMenuEdit((current) => ({ ...current, ...partial }));
  }

  function cancelMenuEdit() {
    setEditingMenuId(null);
    setMenuEdit(initialMenuEdit);
  }

  async function saveMenuEdit(menuId) {
    setFeedback('');
    setError('');
    const price = Number(menuEdit.price);
    if (!menuEdit.name.trim() || !Number.isFinite(price)) {
      setError('Name and price are required for menu edits.');
      return;
    }

    try {
      await api.patch(`/manager/menu/${menuId}`, {
        name: menuEdit.name.trim(),
        price,
        availability: menuEdit.availability,
        ingredientIds: parseIdList(menuEdit.ingredientIds),
      });
      cancelMenuEdit();
      setFeedback('Menu item updated.');
      await loadPage();
    } catch (err) {
      setError(err.message);
    }
  }

  // Creates a new employee or updates an existing one. Detects which by looking up the ID
  // in the already-loaded employees list.
  async function handleEmployeeSubmit(event) {
    event.preventDefault();
    setFeedback('');
    setError('');
    try {
      const body = {
        permission: employeeForm.permission,
        actions: employeeForm.actions,
        changes: employeeForm.changes,
      };

      if (employees.some((employee) => Number(employee.id) === Number(employeeForm.id))) {
        await api.patch(`/manager/employees/${employeeForm.id}`, body);
      } else {
        await api.post('/manager/employees', {
          id: Number(employeeForm.id),
          ...body,
        });
      }
      setEmployeeForm(initialEmployeeForm);
      setFeedback('Employee saved.');
      await loadPage();
    } catch (err) {
      setError(err.message);
    }
  }

  function chooseEmployeePermission(permission) {
    setEmployeeForm((current) => ({ ...current, permission }));
    setEmployeePermissionOpen(false);
    setHoveredEmployeePermission('');
  }

  // Voids an order by ID. Backend records the void with the manager's employee ID
  // so the audit trail in order_voids stays correct.
  async function handleVoidOrder(event) {
    event.preventDefault();
    setFeedback('');
    setError('');
    try {
      const managerId = Number(localStorage.getItem('team26-employee-id') || 1);
      await api.post(`/manager/orders/${voidOrderId}/void`, { managerId });
      setVoidOrderId('');
      setFeedback('Order voided.');
      await loadPage();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleZReset() {
    if (!window.confirm('Reset and close today\'s Z report? This can only be done once per day.')) {
      return;
    }

    setZClosing(true);
    setFeedback('');
    setError('');
    try {
      const managerId = Number(localStorage.getItem('team26-employee-id') || 1);
      const result = await api.post('/manager/reports/z-reset', { managerId });
      setZPreview(result.report);
      setFeedback('Z report reset and archived for end of day.');
      await loadPage();
    } catch (err) {
      setError(err.message);
    } finally {
      setZClosing(false);
    }
  }

  async function handleZResetUndo() {
    if (!window.confirm('Undo today\'s Z report reset and restore the live X/Z reports?')) {
      return;
    }

    setZReopening(true);
    setFeedback('');
    setError('');
    try {
      await api.post('/manager/reports/z-reset/undo', {});
      setFeedback('Z report reset was undone. Live reports are active again.');
      await loadPage();
    } catch (err) {
      setError(err.message);
    } finally {
      setZReopening(false);
    }
  }

  return (
    <section className="manager-page">
      <div className="swing-header">
        <h1>MANAGER DASHBOARD</h1>
        <button onClick={() => logoutUser(navigate)}>[LOGOUT]</button>
      </div>

      <div className="manager-nav">
        {sections.map((section) => (
          <button
            key={section}
            className={section === activeSection ? 'manager-nav-button active' : 'manager-nav-button'}
            onClick={() => handleSectionSelect(section)}
          >
            {section}
          </button>
        ))}
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {feedback ? <p className="success-banner">{feedback}</p> : null}

      {activeSection === 'DASHBOARD' ? (
        <div className="manager-section">
          <div className="manager-metrics">
            <div className="metric-box">
              <span>TOTAL SALES</span>
              <strong>{formatCurrency(dashboard?.totals?.sales)}</strong>
              <small className="metric-unit">USD total revenue</small>
            </div>
            <div className="metric-box">
              <span>ORDERS</span>
              <strong>{formatNumber(dashboard?.totals?.orders)}</strong>
              <small className="metric-unit">orders placed</small>
            </div>
            <div className="metric-box">
              <span>AVG ORDER</span>
              <strong>{formatCurrency(dashboard?.totals?.averageOrder)}</strong>
              <small className="metric-unit">USD per order</small>
            </div>
            <div className="metric-box">
              <span>CASHIERS</span>
              <strong>{formatNumber(dashboard?.totals?.activeCashiers)}</strong>
              <small className="metric-unit">active cashiers</small>
            </div>
          </div>

          <div className="manager-analytics-grid">
            <article className="swing-panel manager-chart-panel">
              <div className="panel-title">SALES TREND</div>
              <h3>Sales (USD)</h3>
              <SalesTrendChart data={dashboard?.salesTrend || []} />
            </article>

            <article className="swing-panel manager-chart-panel">
              <div className="panel-title">TOP ITEMS</div>
              <TopItemsList data={dashboard?.topItems || []} />
            </article>

            <article className="swing-panel manager-chart-panel">
              <div className="panel-title">PEAK HOURS</div>
              <h3>Orders by Hour</h3>
              <PeakHoursChart data={dashboard?.peakHours || []} />
            </article>

            <article className="swing-panel manager-chart-panel">
              <div className="panel-title">REVENUE BY CATEGORY</div>
              <RevenueCategoryChart data={dashboard?.categoryRevenue || []} />
            </article>
          </div>

          <div className="manager-grid-2">
            <article className="swing-panel">
              <div className="panel-title">LOW STOCK</div>
              <div className="list-box">
                {dashboard?.lowStock?.map((item) => (
                  <div className="list-row" key={item.ingredient_id}>
                    <span>{item.name}</span>
                    <strong>
                      {formatNumber(item.quantity)} / {formatNumber(item.threshold)}
                      <small> {item.unit || 'units'}</small>
                    </strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="swing-panel">
              <div className="panel-title">TOP PRODUCT USAGE</div>
              <div className="list-box">
                {dashboard?.productUsage?.map((item) => (
                  <div className="list-row" key={item.ingredientId}>
                    <span>{item.name}</span>
                    <strong>
                      {formatNumber(item.unitsUsed)}
                      <small> {item.unit || 'units'} used</small>
                    </strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {activeSection === 'ORDERS' ? (
        <div className="manager-section">
          <form className="manager-action-row" onSubmit={handleVoidOrder}>
            <label className="compact-field">
              <span>Order ID</span>
              <input value={voidOrderId} onChange={(event) => setVoidOrderId(event.target.value)} />
            </label>
            <button className="swing-primary">VOID ORDER</button>
          </form>

          <article className="swing-panel">
            <div className="panel-title">ORDERS</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Time</th>
                    <th>Total</th>
                    <th>Cashier</th>
                    <th>Source</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>{new Date(order.order_time).toLocaleString()}</td>
                      <td>{formatCurrency(order.total_amount)}</td>
                      <td>{order.cashier ?? '-'}</td>
                      <td>{order.order_source}</td>
                      <td>{order.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      ) : null}

      {activeSection === 'INVENTORY' ? (
        <div className="manager-section">
          <div className="manager-grid-2">
            <form className="swing-panel" onSubmit={handleInventoryCreate}>
              <div className="panel-title">ADD INVENTORY ITEM</div>
              <div className="manager-form-grid">
                <label className="compact-field"><span>Name</span><input value={inventoryForm.name} onChange={(event) => setInventoryForm({ ...inventoryForm, name: event.target.value })} /></label>
                <label className="compact-field"><span>Unit</span><input value={inventoryForm.unit} onChange={(event) => setInventoryForm({ ...inventoryForm, unit: event.target.value })} /></label>
                <label className="compact-field"><span>Qty</span><input value={inventoryForm.quantity} onChange={(event) => setInventoryForm({ ...inventoryForm, quantity: event.target.value })} /></label>
                <label className="compact-field"><span>Threshold</span><input value={inventoryForm.threshold} onChange={(event) => setInventoryForm({ ...inventoryForm, threshold: event.target.value })} /></label>
              </div>
              <button className="swing-primary">ADD NEW ITEM</button>
            </form>
          </div>

          <article className="swing-panel">
            <div className="panel-title">EDIT EXISTING INVENTORY</div>
            <InventoryTable
              items={inventory.map((item) => ({ ...item, lowStock: Number(item.quantity) <= Number(item.threshold) }))}
              editingId={editingInventoryId}
              editDraft={inventoryEdit}
              onStartEdit={startInventoryEdit}
              onDraftChange={updateInventoryEdit}
              onSaveEdit={saveInventoryEdit}
              onCancelEdit={cancelInventoryEdit}
              onDelete={deleteInventoryItem}
            />
          </article>
        </div>
      ) : null}

      {activeSection === 'MENU' ? (
        <div className="manager-section">
          <form className="swing-panel" onSubmit={handleMenuSubmit}>
            <div className="panel-title">ADD MENU ITEM</div>
            <div className="manager-form-grid">
              <label className="compact-field"><span>ID</span><input value={menuForm.id} onChange={(event) => setMenuForm({ ...menuForm, id: event.target.value })} /></label>
              <label className="compact-field"><span>Name</span><input value={menuForm.name} onChange={(event) => setMenuForm({ ...menuForm, name: event.target.value })} /></label>
              <label className="compact-field"><span>Price</span><input value={menuForm.price} onChange={(event) => setMenuForm({ ...menuForm, price: event.target.value })} /></label>
              <label className="compact-field"><span>Ingredient IDs</span><input value={menuForm.ingredientIds} onChange={(event) => setMenuForm({ ...menuForm, ingredientIds: event.target.value })} placeholder="1, 4, 6" /></label>
              <label className="compact-field compact-checkbox"><span>Available</span><input type="checkbox" checked={menuForm.availability} onChange={(event) => setMenuForm({ ...menuForm, availability: event.target.checked })} /></label>
            </div>
            <button className="swing-primary">{menuForm.id ? 'UPDATE' : 'ADD'}</button>
          </form>

          <article className="swing-panel">
            <div className="panel-title">EDIT EXISTING MENU ITEMS</div>
            <div className="table-wrap">
              <table className="menu-edit-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Available</th>
                    <th>Ingredients</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((item) => {
                    const isEditing = Number(editingMenuId) === Number(item.id);
                    return (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>
                          {isEditing ? (
                            <input value={menuEdit.name} onChange={(event) => updateMenuEdit({ name: event.target.value })} />
                          ) : (
                            item.name
                          )}
                        </td>
                        <td>{item.category || '-'}</td>
                        <td>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={menuEdit.price}
                              onChange={(event) => updateMenuEdit({ price: event.target.value })}
                            />
                          ) : (
                            formatCurrency(item.price)
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="checkbox"
                              checked={menuEdit.availability}
                              onChange={(event) => updateMenuEdit({ availability: event.target.checked })}
                            />
                          ) : (
                            String(item.availability)
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              value={menuEdit.ingredientIds}
                              onChange={(event) => updateMenuEdit({ ingredientIds: event.target.value })}
                              placeholder="1, 4, 6"
                            />
                          ) : (
                            item.ingredient_ids || '-'
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div className="inventory-row-actions">
                              <button type="button" className="swing-primary" onClick={() => saveMenuEdit(item.id)}>
                                SAVE
                              </button>
                              <button type="button" className="swing-secondary" onClick={cancelMenuEdit}>
                                CANCEL
                              </button>
                            </div>
                          ) : (
                            <button type="button" className="swing-secondary" onClick={() => startMenuEdit(item)}>
                              EDIT
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      ) : null}

      {activeSection === 'EMPLOYEES' ? (
        <div className="manager-section">
          <form className="swing-panel" onSubmit={handleEmployeeSubmit}>
            <div className="panel-title">EMPLOYEES</div>
            <div className="manager-form-grid">
              <label className="compact-field"><span>ID</span><input value={employeeForm.id} onChange={(event) => setEmployeeForm({ ...employeeForm, id: event.target.value })} /></label>
              <label className="compact-field">
                <span>Permission</span>
                <div className="manager-permission-select" ref={employeePermissionRef}>
                  <button
                    type="button"
                    className="manager-permission-button"
                    aria-haspopup="listbox"
                    aria-expanded={employeePermissionOpen}
                    aria-controls="employee-permission-options"
                    onClick={() => {
                      setHoveredEmployeePermission(employeeForm.permission);
                      setEmployeePermissionOpen((open) => !open);
                    }}
                  >
                    <span>{employeeForm.permission}</span>
                    <span className="manager-permission-arrow" aria-hidden="true" />
                  </button>
                  {employeePermissionOpen ? (
                    <div
                      className="manager-permission-options"
                      id="employee-permission-options"
                      role="listbox"
                      aria-label="Employee permission options"
                      onPointerLeave={() => setHoveredEmployeePermission('')}
                    >
                      {employeePermissionOptions.map((permission) => {
                        const isActive = employeeForm.permission === permission;
                        const isHovered = hoveredEmployeePermission === permission;
                        return (
                          <button
                            key={permission}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            className={[
                              !hoveredEmployeePermission && isActive ? 'active' : '',
                              isHovered ? 'hovered' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onPointerEnter={() => setHoveredEmployeePermission(permission)}
                            onFocus={() => setHoveredEmployeePermission(permission)}
                            onClick={() => chooseEmployeePermission(permission)}
                          >
                            {permission}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </label>
              <label className="compact-field"><span>Actions</span><input value={employeeForm.actions} onChange={(event) => setEmployeeForm({ ...employeeForm, actions: event.target.value })} /></label>
              <label className="compact-field"><span>Changes</span><input value={employeeForm.changes} onChange={(event) => setEmployeeForm({ ...employeeForm, changes: event.target.value })} /></label>
            </div>
            <button className="swing-primary">SAVE EMPLOYEE</button>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Permission</th>
                    <th>Actions</th>
                    <th>Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td>{employee.id}</td>
                      <td>{employee.permission}</td>
                      <td>{employee.actions || '-'}</td>
                      <td>{employee.changes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>
        </div>
      ) : null}

      {activeSection === 'REPORTS' ? (
        <div className="manager-section">
          <div className="manager-grid-2">
            <article className="swing-panel">
              <div className="panel-title">X-REPORT</div>
              <div className="report-lines">
                <p>Date: {xReport?.businessDate || '-'}</p>
                <p>Sales: {xReport ? formatCurrency(xReport.sales) : '-'}</p>
                <p>Cash: {xReport ? formatCurrency(xReport.cashPayments) : '-'}</p>
                <p>Card: {xReport ? formatCurrency(xReport.cardPayments) : '-'}</p>
                <p>Other: {xReport ? formatCurrency(xReport.otherPayments) : '-'}</p>
                <p>Voids: {formatNumber(xReport?.voids)}</p>
              </div>
            </article>

            <article className="swing-panel">
              <div className="panel-title">Z-REPORT PREVIEW</div>
              <div className="report-lines">
                <p>Date: {zPreview?.businessDate || '-'}</p>
                <p>Sales: {zPreview ? formatCurrency(zPreview.sales) : '-'}</p>
                <p>Tax: {zPreview ? formatCurrency(zPreview.tax) : '-'}</p>
                <p>Total Cash: {zPreview ? formatCurrency(zPreview.cashPayments) : '-'}</p>
                <p>Status: {zPreview?.status || '-'}</p>
                {zPreview?.closedAt ? (
                  <p>Closed: {new Date(zPreview.closedAt).toLocaleString()}</p>
                ) : null}
              </div>
              <div className="manager-report-actions">
                <button
                  type="button"
                  className="swing-primary"
                  disabled={zClosing || zReopening || zPreview?.status === 'closed'}
                  onClick={handleZReset}
                >
                  {zClosing ? 'RESETTING...' : 'RESET Z REPORT'}
                </button>
                <button
                  type="button"
                  className="swing-secondary"
                  disabled={zClosing || zReopening || zPreview?.status !== 'closed'}
                  onClick={handleZResetUndo}
                >
                  {zReopening ? 'RESTORING...' : 'UNDO Z RESET'}
                </button>
              </div>
            </article>
          </div>

          <article className="swing-panel">
            <div className="panel-title">HOURLY ACTIVITY</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Hour</th>
                    <th>Orders</th>
                    <th>Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {xReport?.hourly?.map((row) => (
                    <tr key={row.hour}>
                      <td>{String(row.hour).padStart(2, '0')}:00</td>
                      <td>{formatNumber(row.orderCount)}</td>
                      <td>{formatCurrency(row.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}

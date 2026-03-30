import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import StatCard from '../components/StatCard.jsx';
import { logoutUser } from '../utils/session.js';

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function SalesPage() {
  const navigate = useNavigate();
  const [weekly, setWeekly] = useState([]);
  const [summary, setSummary] = useState(null);
  const [peakDay, setPeakDay] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/sales/weekly'), api.get('/sales/summary'), api.get('/sales/peak-day')])
      .then(([weeklyData, summaryData, peakData]) => {
        setWeekly(weeklyData.weeks);
        setSummary(summaryData);
        setPeakDay(peakData.peakDay);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section className="stack-page">
      <div className="section-heading">
        <div className="page-action-row">
          <button onClick={() => logoutUser(navigate)}>Logout</button>
        </div>
        <p className="eyebrow">Sales And History</p>
        <h1>Weekly totals, peak day, and popularity metrics.</h1>
        <p className="page-copy">
          These views reuse the original Project 2 reporting idea and the provided SQL logic for
          weekly sales history, peak sales days, and top menu items.
        </p>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      {summary ? (
        <div className="stats-grid">
          <StatCard label="Total Sales" value={formatCurrency(summary.summary.totalSales)} />
          <StatCard label="Total Orders" value={summary.summary.totalOrders} />
          <StatCard label="Average Order" value={formatCurrency(summary.summary.averageOrder)} />
          <StatCard
            label="Peak Sales Day"
            value={peakDay ? `${peakDay.sales_date} (${formatCurrency(peakDay.daily_total_sales)})` : 'N/A'}
            tone="accent"
          />
        </div>
      ) : null}

      <div className="two-column">
        <article className="surface-card">
          <h2>Weekly Sales History</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Week Start</th>
                  <th>Orders</th>
                  <th>Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map((row) => (
                  <tr key={row.weekStart}>
                    <td>{row.weekStart}</td>
                    <td>{row.numberOfOrders}</td>
                    <td>{formatCurrency(row.weeklyTotalSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="surface-card">
          <h2>Top Items</h2>
          <div className="rank-list">
            {summary?.topItems?.map((item) => (
              <div className="rank-row" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.totalUnitsSold} units sold</p>
                </div>
                <div className="mini-bar">
                  <span style={{ width: `${Math.min(item.totalUnitsSold, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="two-column">
        <article className="surface-card">
          <h2>Order Source Breakdown</h2>
          {summary?.sourceBreakdown?.map((row) => (
            <div className="rank-row" key={row.orderSource}>
              <div>
                <strong>{row.orderSource}</strong>
                <p>{row.orders} orders</p>
              </div>
              <strong>{formatCurrency(row.sales)}</strong>
            </div>
          ))}
        </article>

        <article className="surface-card">
          <h2>Hourly Activity</h2>
          {summary?.hourly?.map((row) => (
            <div className="rank-row" key={row.hourOfDay}>
              <div>
                <strong>{String(row.hourOfDay).padStart(2, '0')}:00</strong>
                <p>{row.orderCount} orders</p>
              </div>
              <strong>{formatCurrency(row.totalSales)}</strong>
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}

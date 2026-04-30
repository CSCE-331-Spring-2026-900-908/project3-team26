// MenuCard: reusable card showing one drink (name, category, price, ingredients) with
// an "Add to Order" button. Used by OrderStation. The compact prop enables a tighter
// layout used inside the kiosk.
// Current kiosk/cashier pages use richer cards, but this stays available for shared flows.
export default function MenuCard({ item, onAdd, compact = false }) {
  return (
    <article className={`menu-card ${compact ? 'compact' : ''}`}>
      <div className="menu-card-header">
        <div>
          <h3>{item.name}</h3>
          <p>{item.category}</p>
        </div>
        <strong>${item.price.toFixed(2)}</strong>
      </div>
      <p className="menu-card-copy">
        {item.ingredients?.length ? item.ingredients.join(', ') : 'Classic menu item from the original project.'}
      </p>
      <button className="action-button" onClick={() => onAdd(item)}>
        Add to Order
      </button>
    </article>
  );
}

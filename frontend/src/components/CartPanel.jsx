export default function CartPanel({
  cart,
  total,
  onIncrement,
  onDecrement,
  onRemove,
  onSubmit,
  title,
  paymentMethod,
  setPaymentMethod,
  loading,
}) {
  return (
    <aside className="cart-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <p>{cart.length} line item(s)</p>
      </div>

      <div className="cart-lines">
        {cart.length === 0 ? (
          <p className="empty-state">Start with a menu item to build the order.</p>
        ) : null}
        {cart.map((line) => (
          <div className="cart-line" key={line.id}>
            <div>
              <strong>{line.name}</strong>
              <p>${line.price.toFixed(2)} each</p>
            </div>
            <div className="cart-controls">
              <button onClick={() => onDecrement(line.id)}>-</button>
              <span>{line.quantity}</span>
              <button onClick={() => onIncrement(line.id)}>+</button>
              <button className="ghost-button" onClick={() => onRemove(line.id)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <label className="field">
        <span>Payment Method</span>
        <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="OTHER">Other</option>
        </select>
      </label>

      <div className="cart-footer">
        <div>
          <p>Total</p>
          <strong>${total.toFixed(2)}</strong>
        </div>
        <button className="action-button large" disabled={!cart.length || loading} onClick={onSubmit}>
          {loading ? 'Submitting...' : 'Submit Order'}
        </button>
      </div>
    </aside>
  );
}
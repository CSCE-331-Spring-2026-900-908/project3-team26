export default function InventoryTable({ items }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Qty</th>
            <th>Threshold</th>
            <th>Unit</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.ingredientId || item.ingredient_id}>
              <td>{item.ingredientId || item.ingredient_id}</td>
              <td>{item.name}</td>
              <td>{Number(item.quantity).toFixed(0)}</td>
              <td>{Number(item.threshold).toFixed(0)}</td>
              <td>{item.unit || '-'}</td>
              <td>{item.lowStock || Number(item.quantity) <= Number(item.threshold) ? 'Low Stock' : 'Healthy'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
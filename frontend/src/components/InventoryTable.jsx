// InventoryTable: inventory table used by ManagerPage. When edit props are provided,
// rows can switch into inline edit mode for existing ingredient/inventory data.
export default function InventoryTable({
  items,
  editingId,
  editDraft,
  onStartEdit,
  onDraftChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}) {
  const canEdit = Boolean(onStartEdit && onDraftChange && onSaveEdit && onCancelEdit);
  const canDelete = Boolean(onDelete);
  const hasActions = canEdit || canDelete;

  return (
    <div className="table-wrap">
      <table className="inventory-edit-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Qty</th>
            <th>Threshold</th>
            <th>Unit</th>
            <th>Status</th>
            {hasActions ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const id = item.ingredientId || item.ingredient_id;
            const isEditing = Number(editingId) === Number(id);
            const lowStock = item.lowStock || Number(item.quantity) <= Number(item.threshold);

            return (
              <tr key={id}>
                <td>{id}</td>
                <td>
                  {isEditing ? (
                    <input value={editDraft.name} onChange={(event) => onDraftChange({ name: event.target.value })} />
                  ) : (
                    item.name
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={editDraft.quantity}
                      onChange={(event) => onDraftChange({ quantity: event.target.value })}
                    />
                  ) : (
                    Number(item.quantity).toFixed(0)
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={editDraft.threshold}
                      onChange={(event) => onDraftChange({ threshold: event.target.value })}
                    />
                  ) : (
                    Number(item.threshold).toFixed(0)
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input value={editDraft.unit} onChange={(event) => onDraftChange({ unit: event.target.value })} />
                  ) : (
                    item.unit || '-'
                  )}
                </td>
                <td>{lowStock ? 'Low Stock' : 'Healthy'}</td>
                {hasActions ? (
                  <td>
                    {isEditing ? (
                      <div className="inventory-row-actions">
                        <button type="button" className="swing-primary" onClick={() => onSaveEdit(id)}>
                          SAVE
                        </button>
                        <button type="button" className="swing-secondary" onClick={onCancelEdit}>
                          CANCEL
                        </button>
                      </div>
                    ) : (
                      <div className="inventory-row-actions">
                        {canEdit ? (
                          <button type="button" className="swing-secondary" onClick={() => onStartEdit(item)}>
                            EDIT
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button type="button" className="danger-button" onClick={() => onDelete(item)}>
                            DELETE
                          </button>
                        ) : null}
                      </div>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

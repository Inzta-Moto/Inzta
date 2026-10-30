export interface SummaryRow {
  label: string;
  value: string;
}

// Order summary `.iz-ordersum` (F-016 S3.3.3, S4.3), announced politely when the choice, quantity, or voucher changes.
export default function OrderSummary({ rows, total }: { rows: SummaryRow[]; total: string }) {
  return (
    <div className="iz-ordersum" aria-live="polite">
      {rows.map(r => (
        <div className="iz-ordersum__row" key={r.label}>
          <span>{r.label}</span>
          <b>{r.value}</b>
        </div>
      ))}
      <div className="iz-ordersum__total">
        <span>Total</span>
        <span>{total}</span>
      </div>
    </div>
  );
}

type Col<T> = { key: keyof T | string; title: string; render?: (row:T)=>React.ReactNode };
export default function DataTable<T extends { id?:string }>({
  cols, rows, right,
}: { cols: Col<T>[]; rows: T[]; right?: (row:T)=>React.ReactNode }) {
  return (
    <div className="overflow-x-auto border rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {cols.map(c => <th key={String(c.key)} className="text-left px-3 py-2">{c.title}</th>)}
            {right && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} className="border-t">
              {cols.map(c => (
                <td key={String(c.key)} className="px-3 py-2">
                  {c.render ? c.render(r) : (r as any)[c.key]}
                </td>
              ))}
              {right && <td className="px-3 py-2">{right(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function KPICards({ items }: { items: {label:string, value:string}[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((k) => (
        <div key={k.label} className="bg-white rounded-xl shadow p-4">
          <div className="text-xs text-gray-500">{k.label}</div>
          <div className="text-xl font-semibold">{k.value}</div>
        </div>
      ))}
    </div>
  );
}

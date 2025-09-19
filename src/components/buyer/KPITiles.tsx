export default function KPITiles({ tiles }: { tiles: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border bg-white p-4">
          <div className="text-sm text-gray-500">{t.label}</div>
          <div className="text-2xl font-bold mt-1">{t.value}</div>
        </div>
      ))}
    </div>
  );
}

export function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const esc = (v:any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const head = headers.join(",");
  const body = rows.map(r => headers.map(h => esc(r[h])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export async function parseCSV(file: File): Promise<any[]> {
  const text = await file.text();
  const [header, ...rows] = text.split(/\r?\n/).filter(Boolean);
  const keys = header.split(",");
  return rows.map(r => {
    const vals = r.split(",");
    return Object.fromEntries(keys.map((k, i) => [k.trim(), vals[i]?.trim()]));
  });
}

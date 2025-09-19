export default function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow p-4">
      <h2 className="font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

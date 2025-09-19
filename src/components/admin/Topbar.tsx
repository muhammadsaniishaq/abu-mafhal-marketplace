export default function Topbar() {
  return (
    <header className="h-14 bg-white shadow flex items-center justify-between px-6">
      <h1 className="font-semibold text-lg">Admin Dashboard</h1>
      <div className="flex items-center gap-4">
        <span className="text-gray-600">Admin</span>
        <img src="/admin-avatar.png" alt="Admin" className="w-8 h-8 rounded-full border" />
      </div>
    </header>
  );
}

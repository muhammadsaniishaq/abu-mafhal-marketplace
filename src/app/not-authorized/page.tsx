// src/app/not-authorized/page.tsx
export default function NotAuthorized() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-center px-6">
      <h1 className="text-5xl font-bold text-red-600">🚫 Access Denied</h1>
      <p className="mt-4 text-gray-700 max-w-xl">
        You do not have permission to view this page. Please contact the admin if you believe this is a mistake.
      </p>
      <a
        href="/"
        className="mt-6 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow hover:bg-red-700 transition"
      >
        Go Home
      </a>
    </div>
  );
}

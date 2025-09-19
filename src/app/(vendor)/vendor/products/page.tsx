"use client";

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">My Products</h1>
      <button className="bg-purple-600 text-white px-4 py-2 rounded">+ Add Product</button>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Example Product Card */}
        <div className="border rounded p-4 bg-white">
          <img
            src="https://via.placeholder.com/150"
            alt="Product"
            className="w-full h-40 object-cover rounded"
          />
          <h2 className="mt-2 font-semibold">Sample Product</h2>
          <p className="text-sm text-gray-600">₦15,000</p>
        </div>
      </div>
    </div>
  );
}

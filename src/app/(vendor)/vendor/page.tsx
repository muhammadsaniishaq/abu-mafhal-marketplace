import KPITiles from "@/components/vendor/KPITiles";

export default function VendorDashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <KPITiles title="Total Sales" value="₦500,000" color="bg-green-600" />
      <KPITiles title="Orders" value="120" color="bg-blue-600" />
      <KPITiles title="Products" value="45" color="bg-purple-600" />
    </div>
  );
}

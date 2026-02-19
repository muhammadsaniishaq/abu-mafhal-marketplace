import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { productService } from "@/services/products";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MoreVertical, Edit, Trash, CheckCircle, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "react-hot-toast";

export default function ProductManager() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            // Admin sees ALL products
            const data = await productService.getProducts();
            setProducts(data || []);
        } catch (error) {
            console.error("Error fetching products:", error);
            toast.error("Failed to load products");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id, newStatus) => {
        try {
            await productService.updateProduct(id, { status: newStatus });

            setProducts(prev =>
                prev.map(p => p.id === id ? { ...p, status: newStatus } : p)
            );
            toast.success(`Product ${newStatus}`);
        } catch (error) {
            toast.error("Update failed");
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'approved': return <Badge variant="success">Approved</Badge>;
            case 'pending': return <Badge variant="warning">Pending</Badge>;
            case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminShell>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Products</h2>
                    <p className="text-gray-500">Manage vendor submissions and inventory.</p>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid gap-4">
                {loading ? (
                    <p className="text-center py-12 text-gray-500">Loading products...</p>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg border border-dashed">
                        <p className="text-gray-500">No products found matching your search.</p>
                    </div>
                ) : (
                    filteredProducts.map((product) => (
                        <Card key={product.id} className="overflow-hidden">
                            <div className="flex flex-col sm:flex-row gap-4 p-4 items-start sm:items-center">
                                {/* Image Thumbnail */}
                                <div className="h-16 w-16 bg-gray-100 rounded-md shrink-0 overflow-hidden">
                                    {/* Just a placeholder logic for now since images are in separate table roughly */}
                                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 bg-gray-50">
                                        IMG
                                    </div>
                                </div>

                                {/* Product Details */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                                        {getStatusBadge(product.status)}
                                    </div>
                                    <p className="text-sm text-gray-500 truncate">
                                        Vendor: <span className="font-medium text-gray-700">{product.vendor?.business_name || product.vendor?.full_name || "Unknown"}</span> •
                                        SKU: {product.sku || "N/A"}
                                    </p>
                                    <p className="font-bold text-primary mt-1">{formatCurrency(product.price)}</p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                                    {product.status === 'pending' && (
                                        <>
                                            <Button size="sm" variant="success" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStatusUpdate(product.id, 'approved')}>
                                                <CheckCircle className="h-4 w-4 sm:mr-1" />
                                                <span className="sr-only sm:not-sr-only">Approve</span>
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate(product.id, 'rejected')}>
                                                <XCircle className="h-4 w-4 sm:mr-1" />
                                                <span className="sr-only sm:not-sr-only">Reject</span>
                                            </Button>
                                        </>
                                    )}
                                    <Button size="icon" variant="ghost">
                                        <Edit className="h-4 w-4 text-gray-500" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </AdminShell>
    );
}

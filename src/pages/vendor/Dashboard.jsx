import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { vendorService } from '@/services/vendor';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Package, ShoppingBag, Wallet, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { VendorShell } from '@/components/layout/VendorShell';

export default function VendorDashboard() {
    const { currentUser } = useAuth();
    const [stats, setStats] = useState({ products: 0, orders: 0, balance: 0, pending: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser?.uid) return;

        const loadData = async () => {
            try {
                // Fetch Products Count
                const products = await vendorService.getVendorProducts(currentUser.uid);

                // Fetch Wallet
                const wallet = await vendorService.getWalletStats(currentUser.uid);

                // Fetch Orders (Mock for now or use orders service)
                // const orders = await orderService.getVendorOrders(currentUser.uid);

                setStats({
                    products: products?.length || 0,
                    orders: 0, // Placeholder
                    products: products?.length || 0,
                    orders: 0, // Placeholder
                    balance: wallet.balance || 0,
                    pending: 0 // Column 'pending_balance' does not exist in current schema
                });
            } catch (error) {
                console.error("Failed to load vendor stats", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [currentUser]);

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <VendorShell>
            <div className="p-4 md:p-8 space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Vendor Dashboard</h1>
                        <p className="text-gray-500">Welcome back, {currentUser?.name}</p>
                    </div>
                    <Button>
                        <Plus className="w-4 h-4 mr-2" /> Add New Product
                    </Button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                            <Wallet className="h-4 w-4 text-gray-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats.balance)}</div>
                            <p className="text-xs text-gray-500">Available for withdrawal</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending</CardTitle>
                            <Loader2 className="h-4 w-4 text-gray-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats.pending)}</div>
                            <p className="text-xs text-gray-500">Clearing soon</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Products</CardTitle>
                            <Package className="h-4 w-4 text-gray-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.products}</div>
                            <p className="text-xs text-gray-500">Active listings</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Orders</CardTitle>
                            <ShoppingBag className="h-4 w-4 text-gray-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.orders}</div>
                            <p className="text-xs text-gray-500">Total processed</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Products */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Recent Products</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-gray-500 text-center py-8">
                                {stats.products === 0 ? "No products yet. Start selling!" : "Product list loading..."}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button variant="outline" className="w-full justify-start">
                                <Settings className="mr-2 h-4 w-4" /> Store Settings
                            </Button>
                            <Button variant="outline" className="w-full justify-start">
                                <Wallet className="mr-2 h-4 w-4" /> Request Payout
                            </Button>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </VendorShell>
    );
}

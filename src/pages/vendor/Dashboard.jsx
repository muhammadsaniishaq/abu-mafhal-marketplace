import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { vendorService } from '@/services/vendor';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Package, ShoppingBag, Wallet, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { VendorShell } from '@/components/layout/VendorShell';
import { useDataCache } from '@/hooks/useDataCache';
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function VendorDashboard() {
    const { currentUser } = useAuth();
    
    // 🚀 SWR Caching: Load from localStorage instantly, fetch in background
    const fetchStats = async () => {
        if (!currentUser?.uid) return null;
        const products = await vendorService.getVendorProducts(currentUser.uid);
        const wallet = await vendorService.getWalletStats(currentUser.uid);
        return {
            products: products?.length || 0,
            orders: 0, // Placeholder
            balance: wallet.balance || 0,
            pending: 0
        };
    };

    const { data: stats, loading } = useDataCache(
        `vendor_stats_${currentUser?.uid}`, 
        fetchStats, 
        { products: 0, orders: 0, balance: 0, pending: 0 }
    );

    // ❌ No more full-screen blocking loader!

    return (
        <VendorShell>
            <div className="p-4 md:p-8 space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Vendor Dashboard</h1>
                        <p className="text-slate-500 font-medium">Welcome back, {currentUser?.name} 👋</p>
                    </div>
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-6 rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-95">
                        <Plus className="w-5 h-5 mr-2" /> Add New Product
                    </Button>
                </div>

                {/* Stats Grid */}
                {loading && stats.products === 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <CardSkeleton />
                        <CardSkeleton />
                        <CardSkeleton />
                        <CardSkeleton />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Total Balance</CardTitle>
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100/50 shadow-sm">
                                    <Wallet className="h-4 w-4 text-emerald-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(stats.balance)}</div>
                                <p className="text-xs text-slate-400 font-medium mt-1">Available for withdrawal</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Pending</CardTitle>
                                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100/50 shadow-sm">
                                    <Loader2 className="h-4 w-4 text-amber-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(stats.pending)}</div>
                                <p className="text-xs text-slate-400 font-medium mt-1">Clearing soon</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Products</CardTitle>
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100/50 shadow-sm">
                                    <Package className="h-4 w-4 text-indigo-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-slate-900 tracking-tight">{stats.products}</div>
                                <p className="text-xs text-slate-400 font-medium mt-1">Active listings</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Orders</CardTitle>
                                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-100/50 shadow-sm">
                                    <ShoppingBag className="h-4 w-4 text-rose-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-slate-900 tracking-tight">{stats.orders}</div>
                                <p className="text-xs text-slate-400 font-medium mt-1">Total processed</p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Products */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="border-b border-slate-50 bg-slate-50/30">
                            <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Recent Products</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-slate-400 font-medium text-center py-12">
                                {stats.products === 0 ? "No products yet. Start selling!" : "Product list loading..."}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader className="border-b border-slate-50 bg-slate-50/30">
                            <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-6">
                            <Button variant="outline" className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200 rounded-xl font-bold py-6 transition-all">
                                <Settings className="mr-3 h-4 w-4 text-slate-400" /> Store Settings
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200 rounded-xl font-bold py-6 transition-all">
                                <Wallet className="mr-3 h-4 w-4 text-slate-400" /> Request Payout
                            </Button>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </VendorShell>
    );
}

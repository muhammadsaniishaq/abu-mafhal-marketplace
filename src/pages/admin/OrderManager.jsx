import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { getAllOrders, updateOrderStatus } from "@/services/orders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Truck, Check, RefreshCw, AlertCircle, User, MapPin } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabaseClient";

const STATUS_FILTERS = ['all', 'pending', 'processing', 'shipped', 'delivered'];

export default function OrderManager() {
    const [orders, setOrders] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all');

    useEffect(() => {
        fetchOrders();
        fetchDrivers();
    }, [activeFilter]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const data = await getAllOrders(activeFilter);
            setOrders(data || []);
        } catch (error) {
            toast.error("Failed to load orders");
        } finally {
            setLoading(false);
        }
    };

    const fetchDrivers = async () => {
        const { data, error } = await supabase.from('drivers').select('*');
        if (!error) setDrivers(data || []);
    };

    const updateStatus = async (id, status) => {
        try {
            await updateOrderStatus(id, status);
            toast.success(`Order marked as ${status}`);
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
        } catch (e) {
            toast.error("Failed to update status");
        }
    }

    const assignDriver = async (orderId, driverId) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ driver_id: driverId })
                .eq('id', orderId);

            if (error) throw error;

            toast.success("Driver assigned successfully");
            // Refresh local state
            setOrders(prev => prev.map(o => {
                if (o.id === orderId) {
                    const driver = drivers.find(d => d.id === driverId);
                    return { ...o, driver_id: driverId, drivers: driver };
                }
                return o;
            }));
        } catch (e) {
            console.error(e);
            toast.error("Failed to assign driver");
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'processing': return 'bg-blue-100 text-blue-800';
            case 'shipped': return 'bg-purple-100 text-purple-800';
            case 'delivered': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    return (
        <AdminShell>
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">Orders & Logistics</h2>
                <p className="text-gray-500">Track orders and assign drivers for delivery.</p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
                {STATUS_FILTERS.map(slug => (
                    <button
                        key={slug}
                        onClick={() => setActiveFilter(slug)}
                        className={`px-4 py-2 rounded-full text-sm font-medium capitalize whitespace-nowrap transition-colors ${activeFilter === slug
                            ? 'bg-primary text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        {slug}
                    </button>
                ))}
            </div>

            <div className="grid gap-4">
                {loading ? (
                    <div className="text-center py-12">Loading orders...</div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-12 bg-white border border-dashed rounded-lg">No orders found.</div>
                ) : (
                    orders.map(order => (
                        <Card key={order.id} className="p-4 overflow-visible">
                            <div className="flex flex-col gap-4">
                                {/* Top Row: Info & Status */}
                                <div className="flex flex-col md:flex-row justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-xs text-gray-400">#{order.id.slice(0, 8)}</span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-gray-900">{formatCurrency(order.total_amount)}</h3>
                                        <div className="text-sm text-gray-500 mt-1">
                                            <div className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {order.profiles?.full_name || order.profiles?.email || "Guest"}
                                            </div>
                                            {/* Shipping Address Preview */}
                                            {order.shipping_address && (
                                                <div className="flex items-center gap-1 mt-1 truncate max-w-md">
                                                    <MapPin className="w-3 h-3" />
                                                    {typeof order.shipping_address === 'string'
                                                        ? JSON.parse(order.shipping_address).address
                                                        : order.shipping_address?.address}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap items-start gap-2">
                                        {order.status === 'pending' && (
                                            <Button size="sm" variant="outline" onClick={() => updateStatus(order.id, 'processing')}>
                                                <RefreshCw className="h-3 w-3 mr-2" />
                                                Process
                                            </Button>
                                        )}
                                        {order.status === 'processing' && (
                                            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => updateStatus(order.id, 'shipped')}>
                                                <Truck className="h-3 w-3 mr-2" />
                                                Ship
                                            </Button>
                                        )}
                                        {order.status === 'shipped' && (
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus(order.id, 'delivered')}>
                                                <Check className="h-3 w-3 mr-2" />
                                                Deliver
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-gray-100" />

                                {/* Bottom Row: Logistics / Driver Assignment */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-full ${order.drivers ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                            <Truck className={`w-4 h-4 ${order.drivers ? 'text-blue-600' : 'text-gray-400'}`} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-700">Logistics Partner</p>
                                            {order.drivers ? (
                                                <p className="text-sm text-blue-600 font-medium">{order.drivers.name}</p>
                                            ) : (
                                                <p className="text-sm text-gray-400 italic">No driver assigned</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Driver Select */}
                                    <div className="flex items-center gap-2">
                                        <select
                                            className="text-sm border rounded px-2 py-1 bg-white"
                                            value={order.driver_id || ""}
                                            onChange={(e) => assignDriver(order.id, e.target.value)}
                                            disabled={order.status === 'delivered' || order.status === 'cancelled'}
                                        >
                                            <option value="">-- Assign Driver --</option>
                                            {drivers.map(d => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name} ({d.vehicle_type})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </AdminShell>
    );
}

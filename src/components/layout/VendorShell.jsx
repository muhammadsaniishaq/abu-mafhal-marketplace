import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
    LayoutDashboard, Package, ShoppingBag, Wallet, Settings,
    LogOut, Menu, X, Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function VendorShell({ children }) {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/vendor/dashboard' },
        { icon: Package, label: 'Products', path: '/vendor/products' },
        { icon: ShoppingBag, label: 'Orders', path: '/vendor/orders' },
        { icon: Wallet, label: 'Wallet', path: '/vendor/wallet' },
        { icon: Settings, label: 'Settings', path: '/vendor/settings' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
                md:translate-x-0 md:static md:h-screen
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="h-full flex flex-col">
                    <div className="p-6 border-b border-gray-100 flex items-center gap-2">
                        <div className="bg-brand-teal/10 p-2 rounded-lg">
                            <Store className="w-6 h-6 text-brand-teal" />
                        </div>
                        <span className="font-bold text-xl text-gray-900">Vendor Portal</span>
                        <button
                            className="md:hidden ml-auto text-gray-500"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`
                                        flex items-center gap-3 px-4 py-3 rounded-xl transition-colors
                                        ${isActive
                                            ? 'bg-brand-teal/10 text-brand-teal font-semibold'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }
                                    `}
                                >
                                    <item.icon size={20} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-gray-100">
                        <div className="flex items-center gap-3 px-4 py-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal font-bold">
                                {currentUser?.name?.[0] || 'V'}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-medium text-gray-900 truncate">{currentUser?.name}</p>
                                <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Log Out
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-brand-teal/10 p-1.5 rounded-lg">
                            <Store className="w-5 h-5 text-brand-teal" />
                        </div>
                        <span className="font-bold text-gray-900">Vendor Portal</span>
                    </div>
                    <button onClick={() => setSidebarOpen(true)}>
                        <Menu size={24} className="text-gray-600" />
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}

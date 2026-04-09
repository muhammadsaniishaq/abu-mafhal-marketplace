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
        <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-[280px] bg-white/80 backdrop-blur-xl border-r border-slate-200 transform transition-transform duration-300 ease-in-out
                md:translate-x-0 md:static md:h-screen
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="h-full flex flex-col">
                    <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
                        <div className="flex items-center gap-3 group">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/30 text-white">
                                AM
                            </div>
                            <div>
                                <p className="font-black text-sm text-slate-900 leading-none">Vendor Portal</p>
                                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-0.5">Abu Mafhal</p>
                            </div>
                        </div>
                        <button
                            className="md:hidden w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-all"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`
                                        flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200
                                        ${isActive
                                            ? 'bg-blue-50 text-blue-600 border border-blue-100 shadow-sm shadow-blue-500/5'
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                        }
                                    `}
                                >
                                    <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-slate-100 space-y-2">
                        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-sm shadow-md shadow-blue-500/20">
                                {currentUser?.name?.[0] || 'V'}
                            </div>
                            <div className="overflow-hidden min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate">{currentUser?.name || 'Vendor'}</p>
                                <p className="text-[10px] text-slate-400 font-bold truncate uppercase tracking-tighter">{currentUser?.email}</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl font-bold transition-all group"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                            Sign Out
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden h-16 bg-white/70 backdrop-blur-xl border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xs shadow-md shadow-blue-500/20">
                            AM
                        </div>
                        <span className="font-black text-slate-900 tracking-tight">Vendor Portal</span>
                    </div>
                    <button 
                        onClick={() => setSidebarOpen(true)}
                        className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-950 hover:bg-slate-50 rounded-xl transition-all border border-slate-100 shadow-sm"
                    >
                        <Menu size={20} />
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}

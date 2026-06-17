import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { userService } from "@/services/users";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, User, Shield, Store, MoreVertical, MessageSquare } from "lucide-react";
import { toast } from "react-hot-toast";
import { whatsappService } from "@/services/whatsappService";

const ROLES = ['all', 'admin', 'vendor', 'buyer'];

export default function UserManager() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState("");

    // WhatsApp messaging state
    const [selectedUser, setSelectedUser] = useState(null);
    const [recipientPhone, setRecipientPhone] = useState("");
    const [messageText, setMessageText] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState("custom");
    const [sendingMessage, setSendingMessage] = useState(false);

    const TEMPLATES = [
        { id: 'custom', label: 'Custom Message' },
        { id: 'welcome', label: 'Welcome Message', text: 'Hello {name}, welcome to Abu Mafhal! 🎉 Your account is active. We are excited to have you on board!' },
        { id: 'support', label: 'Support Reply', text: 'Hi {name}, regarding your support request: ' },
        { id: 'order', label: 'Order Update', text: 'Hello {name}, your order status has been updated. Please check your dashboard for details.' }
    ];

    const handleTemplateChange = (e) => {
        const val = e.target.value;
        setSelectedTemplate(val);
        if (val !== 'custom') {
            const tmpl = TEMPLATES.find(t => t.id === val);
            if (tmpl) {
                setMessageText(tmpl.text.replace('{name}', selectedUser?.full_name || 'Customer'));
            }
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!recipientPhone || !messageText) {
            toast.error("Please fill in all fields");
            return;
        }
        setSendingMessage(true);
        try {
            const res = await whatsappService.sendDirect(recipientPhone, messageText, selectedUser?.id);
            if (res.success) {
                toast.success("WhatsApp message sent successfully!");
                setSelectedUser(null);
                setMessageText("");
                setSelectedTemplate("custom");
            } else {
                toast.error("Failed to send message: " + (res.error || "Unknown error"));
            }
        } catch (err) {
            console.error(err);
            toast.error("Error sending message: " + err.message);
        } finally {
            setSendingMessage(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [activeFilter]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await userService.getUsers(activeFilter);
            setUsers(data || []);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    const handleRoleUpdate = async (userId, newRole) => {
        // Confirm action
        if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

        try {
            await userService.updateUserRole(userId, newRole);

            toast.success("User role updated");
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (error) {
            toast.error("Failed to update role");
            console.error(error);
        }
    };

    const filteredUsers = users.filter(u =>
        (u.full_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (u.email?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );

    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">Admin</Badge>;
            case 'vendor': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Vendor</Badge>;
            default: return <Badge variant="secondary">Buyer</Badge>;
        }
    }

    return (
        <AdminShell>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Users & Vendors</h2>
                    <p className="text-gray-500">Manage platform access and roles.</p>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Role Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
                {ROLES.map(role => (
                    <button
                        key={role}
                        onClick={() => setActiveFilter(role)}
                        className={`px-4 py-2 rounded-full text-sm font-medium capitalize whitespace-nowrap transition-colors ${activeFilter === role
                            ? 'bg-primary text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        {role}
                    </button>
                ))}
            </div>

            <div className="grid gap-3">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading profiles...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12 bg-white border border-dashed rounded-lg text-gray-500">
                        No users found.
                    </div>
                ) : (
                    filteredUsers.map(user => (
                        <Card key={user.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold shrink-0">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.full_name} className="h-full w-full rounded-full object-cover" />
                                ) : (
                                    (user.full_name?.[0] || "U").toUpperCase()
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-gray-900 truncate">{user.full_name || "Unnamed User"}</h3>
                                    {getRoleBadge(user.role)}
                                </div>
                                <p className="text-sm text-gray-500 truncate">{user.email}</p>
                                {user.business_name && (
                                    <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                                        <Store size={12} /> {user.business_name}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                                {user.phone && (
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 flex items-center gap-1.5"
                                        onClick={() => {
                                            setSelectedUser(user);
                                            setRecipientPhone(user.phone);
                                            setMessageText("");
                                            setSelectedTemplate("custom");
                                        }}
                                    >
                                        <MessageSquare size={14} /> WhatsApp
                                    </Button>
                                )}
                                {user.role === 'buyer' && (
                                    <Button size="sm" variant="outline" onClick={() => handleRoleUpdate(user.id, 'vendor')}>
                                        Promote to Vendor
                                    </Button>
                                )}
                                {user.role === 'vendor' && (
                                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleRoleUpdate(user.id, 'buyer')}>
                                        Demote to Buyer
                                    </Button>
                                )}
                                <Button size="icon" variant="ghost">
                                    <MoreVertical size={16} className="text-gray-400" />
                                </Button>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* WhatsApp Quick Message Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 relative">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Send WhatsApp Message</h3>
                        <p className="text-sm text-gray-500 mb-4 flex justify-between">
                            <span>To: <span className="font-semibold text-gray-700">{selectedUser.full_name || "User"}</span></span>
                            {recipientPhone && (
                                <a 
                                    href={`https://wa.me/${recipientPhone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                                >
                                    Open Direct Chat
                                </a>
                            )}
                        </p>
                        
                        <form onSubmit={handleSendMessage} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Recipient Phone</label>
                                <input 
                                    type="text" 
                                    required
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={recipientPhone}
                                    onChange={e => setRecipientPhone(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Select Template</label>
                                <select 
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={selectedTemplate}
                                    onChange={handleTemplateChange}
                                >
                                    {TEMPLATES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Message Text</label>
                                <textarea 
                                    required
                                    rows={4}
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={messageText}
                                    onChange={e => setMessageText(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={() => setSelectedUser(null)}
                                    disabled={sendingMessage}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    type="submit" 
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    disabled={sendingMessage}
                                >
                                    {sendingMessage ? "Sending..." : "Send Message"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminShell>
    );
}

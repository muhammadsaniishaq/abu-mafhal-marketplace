import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input"; // Assuming we have or will treat standard input
import { Label } from "@/components/ui/label"; // standard UI
import { Trash, Plus, Folder, ImageIcon } from "lucide-react";
import { toast } from "react-hot-toast";

// Simple UI components if not imported from library yet
const SimpleInput = ({ label, ...props }) => (
    <div className="space-y-1">
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</label>
        <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" {...props} />
    </div>
);

export default function CategoryManager() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newCatName, setNewCatName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCategories(data || []);
        } catch (error) {
            toast.error("Failed to load categories");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newCatName.trim()) return;

        setIsCreating(true);
        const slug = newCatName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

        try {
            const { data, error } = await supabase
                .from('categories')
                .insert([{ name: newCatName, slug, is_active: true }])
                .select()
                .single();

            if (error) throw error;

            setCategories([data, ...categories]);
            setNewCatName("");
            toast.success("Category created");
        } catch (error) {
            toast.error("Failed to create category");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this category? Products in this category will be uncategorized.")) return;

        try {
            const { error } = await supabase.from('categories').delete().eq('id', id);
            if (error) throw error;

            setCategories(categories.filter(c => c.id !== id));
            toast.success("Category deleted");
        } catch (error) {
            toast.error("Delete failed");
        }
    };

    return (
        <AdminShell>
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Categories</h2>
                    <p className="text-gray-500">Organize products into browsing sections.</p>
                </div>

                <div className="grid gap-8 md:grid-cols-3">
                    {/* Create Form */}
                    <Card className="p-6 h-fit md:col-span-1">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Plus size={18} /> New Category
                        </h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <SimpleInput
                                label="Name"
                                placeholder="e.g. Smartphones"
                                value={newCatName}
                                onChange={e => setNewCatName(e.target.value)}
                            />
                            <Button type="submit" disabled={isCreating || !newCatName} className="w-full">
                                {isCreating ? "Saving..." : "Create Category"}
                            </Button>
                        </form>
                    </Card>

                    {/* List */}
                    <Card className="p-0 overflow-hidden md:col-span-2">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 font-medium text-sm text-gray-500">
                            All Categories ({categories.length})
                        </div>
                        {loading ? (
                            <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
                        ) : categories.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No categories yet.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {categories.map((cat) => (
                                    <li key={cat.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                                <Folder size={20} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{cat.name}</p>
                                                <p className="text-xs text-gray-400 font-mono">/{cat.slug}</p>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDelete(cat.id)}
                                        >
                                            <Trash size={16} />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>
        </AdminShell>
    );
}

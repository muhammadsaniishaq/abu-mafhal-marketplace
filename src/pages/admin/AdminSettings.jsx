import React, { useState, useEffect } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/config/supabase";
import { useDataCache } from "@/hooks/useDataCache";
import { Skeleton } from "@/components/ui/Skeleton";

export default function AdminSettings() {
    // 🚀 SWR Caching: Platform settings appear instantly
    const fetchSettings = async () => {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .single();
        if (error) throw error;
        return data;
    };

    const { data: settings, loading, revalidate } = useDataCache(
        'admin_settings_global', 
        fetchSettings, 
        { commission_rate: 10, paystack_public_key: "", maintenance_mode: false }
    );
    
    // We still need local state for the form inputs
    const [formData, setFormData] = useState(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    // Update form data when settings arrive from cache or server
    useEffect(() => {
        if (settings && !formData) {
            setFormData(settings);
        }
    }, [settings, formData]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage("");

        try {
            const { error } = await supabase
                .from('app_settings')
                .update(formData)
                .eq('is_singleton', true);

            if (error) {
                setMessage(`Error: ${error.message}`);
            } else {
                setMessage("Settings saved successfully!");
                revalidate(); // Refresh cache
                setTimeout(() => setMessage(""), 3000);
            }
        } catch (err) {
            setMessage(`Error: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    // ❌ No more blocking full-screen loader

    return (
        <AdminShell>
            <div className="max-w-2xl mx-auto space-y-8 py-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 font-sans">Platform Settings</h2>
                    <p className="text-slate-500 font-medium">Configure global marketplace variables and security.</p>
                </div>

                <form onSubmit={handleSave} className="space-y-6 pb-20">
                    <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-6">
                            <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Financial Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-8 px-6 pb-8">
                            <div className="space-y-2">
                                <Label className="text-slate-900 font-bold text-sm">Platform Commission Rate (%)</Label>
                                {!formData ? <Skeleton className="h-12 w-full rounded-xl" /> : (
                                    <Input
                                        type="number"
                                        className="h-12 rounded-xl border-slate-200 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-bold"
                                        value={formData?.commission_rate || 10}
                                        onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) })}
                                    />
                                )}
                                <p className="text-xs text-slate-400 font-medium">Percentage taken from every vendor sale.</p>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                <Label className="text-slate-900 font-bold flex items-center gap-2 text-sm">
                                    <span className="p-1 px-3 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-indigo-100">Paystack</span> Public Key
                                </Label>
                                {!formData ? <Skeleton className="h-12 w-full rounded-xl" /> : (
                                    <Input
                                        type="password"
                                        placeholder="pk_test_..."
                                        className="h-12 rounded-xl border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                                        value={formData?.paystack_public_key || ""}
                                        onChange={(e) => setFormData({ ...formData, paystack_public_key: e.target.value })}
                                    />
                                )}
                                <p className="text-xs text-slate-400 font-medium">Required for wallet top-ups. Get this from your Paystack Dashboard.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-red-100 shadow-sm overflow-hidden rounded-2xl">
                        <CardHeader className="bg-red-50/20 border-b border-red-50 py-6">
                            <CardTitle className="text-red-600 flex items-center gap-2 text-lg font-black tracking-tight">
                                <AlertTriangle size={20} className="text-red-500" /> Danger Zone
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-8 px-6 pb-8">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-black text-slate-900">Maintenance Mode</Label>
                                    <p className="text-sm text-slate-500 font-medium">Disable all purchases and public access.</p>
                                </div>
                                {!formData ? <Skeleton className="w-12 h-6 rounded-full" /> : (
                                    <input
                                        type="checkbox"
                                        className="w-6 h-6 accent-red-600 rounded-lg cursor-pointer transition-transform active:scale-90"
                                        checked={formData?.maintenance_mode || false}
                                        onChange={(e) => setFormData({ ...formData, maintenance_mode: e.target.checked })}
                                    />
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center gap-4 fixed bottom-8 right-8 bg-white/80 backdrop-blur-xl p-4 px-6 rounded-2xl shadow-2xl border border-slate-100 z-50 animate-float">
                        {message && (
                            <div className={`p-2.5 px-5 rounded-xl text-sm font-black flex items-center gap-2 transition-all shadow-lg ${message.includes('Error') ? 'bg-red-50 text-red-600 shadow-red-200/20' : 'bg-emerald-50 text-emerald-600 shadow-emerald-200/20'}`}>
                                {message.includes('Error') ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                                {message}
                            </div>
                        )}
                        <Button type="submit" disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white px-10 h-14 rounded-2xl shadow-xl shadow-slate-900/30 flex items-center gap-3 transition-all active:scale-95 font-black text-base">
                            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </div>
        </AdminShell>
    );
}

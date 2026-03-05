import React, { useState, useEffect } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/config/supabase";

export default function AdminSettings() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .single();

            if (data) {
                setSettings(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage("");

        try {
            const { error } = await supabase
                .from('app_settings')
                .update(settings)
                .eq('is_singleton', true);

            if (error) {
                setMessage(`Error: ${error.message}`);
            } else {
                setMessage("Settings saved successfully!");
                setTimeout(() => setMessage(""), 3000);
            }
        } catch (err) {
            setMessage(`Error: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminShell>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="animate-spin text-primary" size={40} />
                </div>
            </AdminShell>
        );
    }

    return (
        <AdminShell>
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-outfit">Platform Settings</h2>
                    <p className="text-gray-500">Configure global marketplace variables.</p>
                </div>

                <form onSubmit={handleSave} className="space-y-6 pb-20">
                    <Card className="border-slate-200">
                        <CardHeader className="bg-slate-50 border-b border-slate-100">
                            <CardTitle className="text-lg">Financial Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-2">
                                <Label className="text-slate-700 font-medium">Platform Commission Rate (%)</Label>
                                <Input
                                    type="number"
                                    value={settings?.commission_rate || 10}
                                    onChange={(e) => setSettings({ ...settings, commission_rate: parseFloat(e.target.value) })}
                                />
                                <p className="text-xs text-gray-500">Percentage taken from every vendor sale.</p>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                <Label className="text-slate-700 font-bold flex items-center gap-2">
                                    <span className="p-1 px-2 bg-blue-100 text-blue-700 rounded text-xs">API</span> Paystack Public Key
                                </Label>
                                <Input
                                    type="password"
                                    placeholder="pk_test_..."
                                    value={settings?.paystack_public_key || ""}
                                    onChange={(e) => setSettings({ ...settings, paystack_public_key: e.target.value })}
                                />
                                <p className="text-xs text-gray-500">Required for wallet top-ups. Get this from your Paystack Dashboard.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-red-100">
                        <CardHeader className="bg-red-50/30 border-b border-red-50">
                            <CardTitle className="text-red-800 flex items-center gap-2 text-lg font-medium">
                                <AlertTriangle size={20} /> Danger Zone
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-medium">Maintenance Mode</Label>
                                    <p className="text-sm text-gray-500">Disable all purchases and public access.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-red-600 rounded"
                                    checked={settings?.maintenance_mode || false}
                                    onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center gap-4 fixed bottom-8 right-8 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 z-50">
                        {message && (
                            <div className={`p-2 px-4 rounded-xl text-sm flex items-center gap-2 transition-all shadow-sm ${message.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                {message.includes('Error') ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                                {message}
                            </div>
                        )}
                        <Button type="submit" disabled={saving} className="bg-black hover:bg-slate-800 text-white px-8 h-12 rounded-xl shadow-lg flex items-center gap-2 transition-transform active:scale-95">
                            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            Save All Changes
                        </Button>
                    </div>
                </form>
            </div>
        </AdminShell>
    );
}

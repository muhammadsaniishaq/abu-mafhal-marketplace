import React from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch"; // Need to ensure we have this or simulate it
import { Label } from "@/components/ui/label";
import { Save, AlertTriangle } from "lucide-react";

// Simple Switch/Checkbox simulation if component missing
const SimpleSwitch = ({ checked, onCheckedChange }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-gray-200'}`}
    >
        <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
);

export default function AdminSettings() {
    return (
        <AdminShell>
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Platform Settings</h2>
                    <p className="text-gray-500">Configure global marketplace variables.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Financial Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Platform Commission Rate (%)</Label>
                            <div className="flex gap-2">
                                <input className="flex h-10 w-full rounded-md border border-input px-3" type="number" placeholder="5" defaultValue="5" />
                                <Button variant="outline">Update</Button>
                            </div>
                            <p className="text-xs text-gray-500">Percentage taken from every vendor sale.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-red-100">
                    <CardHeader>
                        <CardTitle className="text-red-800 flex items-center gap-2">
                            <AlertTriangle size={20} /> Danger Zone
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Maintenance Mode</Label>
                                <p className="text-sm text-gray-500">Disable all purchases and public access.</p>
                            </div>
                            <SimpleSwitch checked={false} onCheckedChange={() => { }} />
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-red-100">
                            <div className="space-y-0.5">
                                <Label className="text-base text-red-600">Reset System Cache</Label>
                                <p className="text-sm text-gray-500">Clear all server-side caches (Redis/CDN).</p>
                            </div>
                            <Button variant="destructive" size="sm">Clear Cache</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminShell>
    );
}

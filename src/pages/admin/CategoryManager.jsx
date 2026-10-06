import React from "react";
import AdminCategories from "@/components/admin/AdminCategories";
import { AdminShell } from "@/components/layout/AdminShell";

export default function CategoryManager() {
    return (
        <AdminShell>
            <div className="max-w-7xl mx-auto p-4 sm:p-6">
                <AdminCategories />
            </div>
        </AdminShell>
    );
}

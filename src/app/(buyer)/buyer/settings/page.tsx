"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import Section from "@/components/buyer/Section";

export default function SettingsPage() {
  const { user } = useAuthUser();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      <Section title="Profile">
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-500">Name</div>
            <div className="font-medium">{user?.name || "-"}</div>
          </div>
          <div>
            <div className="text-gray-500">Email</div>
            <div className="font-medium">{user?.email || "-"}</div>
          </div>
          <div>
            <div className="text-gray-500">Phone</div>
            <div className="font-medium">{user?.phone || "-"}</div>
          </div>
        </div>
      </Section>

      <Section title="Security">
        <div className="flex gap-2">
          <button className="border px-3 py-1 rounded">Enable 2FA</button>
          <button className="border px-3 py-1 rounded">Reset Password</button>
        </div>
      </Section>

      <Section title="Preferences">
        <div className="flex gap-2">
          <button className="border px-3 py-1 rounded">Dark Mode</button>
          <button className="border px-3 py-1 rounded">Language</button>
          <button className="border px-3 py-1 rounded">Currency</button>
        </div>
      </Section>

      <Section title="Danger Zone">
        <button className="border px-3 py-1 rounded text-red-600">Delete Account</button>
      </Section>
    </div>
  );
}

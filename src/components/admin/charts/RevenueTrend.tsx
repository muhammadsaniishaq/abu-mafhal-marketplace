"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function RevenueTrend({ data }: { data: { date: string; revenue: number }[] }) {
  return (
    <div className="card">
      <h3 className="section-title">Revenue Trend</h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="revenue" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

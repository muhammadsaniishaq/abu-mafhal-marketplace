"use client";

import React from "react";

interface KPITileProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string; // e.g., "bg-blue-500"
}

export default function KPITiles({ title, value, icon, color = "bg-blue-500" }: KPITileProps) {
  return (
    <div className={`card flex items-center gap-4 p-4 ${color} text-white`}>
      <div className="text-3xl">{icon}</div>
      <div>
        <p className="text-sm opacity-80">{title}</p>
        <h2 className="text-xl font-bold">{value}</h2>
      </div>
    </div>
  );
}

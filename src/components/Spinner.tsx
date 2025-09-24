"use client";

import React from "react";

export default function Spinner() {
  return (
    <div className="flex items-center justify-center w-full h-full p-10">
      <div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
    </div>
  );
}

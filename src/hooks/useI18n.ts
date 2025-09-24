"use client";
import { useEffect, useState } from "react";
import { dict } from "@/i18n/dict";

export function useI18n(defaultLang: "en"|"ha"|"ar"|"fr" = "en") {
  const [lang, setLang] = useState(defaultLang);
  useEffect(() => {
    const saved = localStorage.getItem("lang");
    if (saved && saved in dict) setLang(saved as any);
  }, []);
  const t = (key: keyof typeof dict["en"]) => dict[lang][key] || key;
  return { lang, setLang, t };
}

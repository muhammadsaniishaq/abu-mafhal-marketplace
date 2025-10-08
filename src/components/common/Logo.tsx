"use client";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <Link href="/" aria-label="Abu Mafhal">
      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Image src="/logo.png" alt="Abu Mafhal Logo" width={size} height={size} priority />
        <span className="text-xl font-bold">Abu Mafhal</span>
      </motion.div>
    </Link>
  );
}

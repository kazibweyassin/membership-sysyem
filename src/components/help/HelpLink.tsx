"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";

/**
 * Small "?" button that deep-links into the relevant section of /help.
 * Rendered in page headers so help is always one click from where you are.
 */
export default function HelpLink({
  section,
  label = "Help",
  className = "",
}: {
  section: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={`/help#${section}`}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors ${className}`}
    >
      <HelpCircle className="w-5 h-5" />
    </Link>
  );
}
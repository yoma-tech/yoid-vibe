import Link from "next/link";
import { ReactNode } from "react";

const NAV = [
  { label: "Dashboard", href: "/issuer" },
  { label: "Presets", href: "/issuer/presets" },
  { label: "Templates", href: "/issuer/templates" },
  { label: "Issue", href: "/issuer/issue" },
  { label: "Bulk Import", href: "/issuer/bulk" },
];

export default function IssuerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Issuer Portal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Learning &amp; Impact Partner — issue and manage verifiable credentials
        </p>
      </div>
      <nav className="flex gap-1 mb-6 border-b border-gray-200">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent hover:border-gray-300 transition-colors -mb-px"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

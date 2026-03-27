"use client";

import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";

const ROLES = [
  { label: "Issuer", href: "/issuer", description: "Learning & Impact Partner" },
  { label: "Verifier", href: "/verifier", description: "Employer & Opportunity Provider" },
] as const;

export function RoleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();

  const activeRole = ROLES.find((r) => pathname.startsWith(r.href));

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {ROLES.map((role) => {
        const active = pathname.startsWith(role.href);
        return (
          <button
            key={role.href}
            onClick={() => router.push(role.href)}
            className={clsx(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {role.label}
          </button>
        );
      })}
    </div>
  );
}

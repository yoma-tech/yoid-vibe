import type { Metadata } from "next";
import "./globals.css";
import { RoleSwitcher } from "@/components/role-switcher";

export const metadata: Metadata = {
  title: "YoID Demo",
  description: "YoID verifiable credentials demonstrator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">YoID</span>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                Demo
              </span>
            </a>
            <RoleSwitcher />
            <a
              href="/setup"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Setup
            </a>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

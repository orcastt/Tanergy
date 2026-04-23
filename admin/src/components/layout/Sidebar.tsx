"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Server,
  Cpu,
  CreditCard,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/api-logs", label: "API Logs", icon: FileText },
  { href: "/providers", label: "Providers", icon: Server },
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/credits", label: "Credits", icon: CreditCard },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-slate-900 text-white transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-slate-700 px-4">
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight">
            Tangent Admin
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 hover:bg-slate-700"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

"use client";

import { isLoggedIn } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoggedIn() && pathname !== "/login") {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Login page: no shell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

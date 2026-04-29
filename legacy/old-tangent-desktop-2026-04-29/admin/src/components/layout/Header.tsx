"use client";

import { getAdminEmail, logout } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function Header() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setEmail(getAdminEmail());
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div className="text-sm text-muted-foreground">
        {email && <span>{email}</span>}
      </div>
      <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5">
        <LogOut className="size-4" />
        Logout
      </Button>
    </header>
  );
}

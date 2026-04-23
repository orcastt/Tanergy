"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  balance: number;
  plan: string;
  created_at: string;
  last_login_at: string | null;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const limit = 50;

  function fetchUsers() {
    setLoading(true);
    apiGet<User[]>(`/api/v1/admin/users?skip=${skip}&limit=${limit}`)
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  async function handleToggleActive(user: User) {
    try {
      await apiPost(`/api/v1/admin/users/${user.id}/toggle-active`, {
        is_active: !user.is_active,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, is_active: !u.is_active } : u
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle");
    }
  }

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Input
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">Loading users...</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/users/${user.id}`)}
                >
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{user.plan || "-"}</TableCell>
                  <TableCell className="text-right">
                    {user.balance.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "default" : "destructive"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(user);
                      }}
                    >
                      {user.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {skip + 1}-{Math.min(skip + limit, skip + filtered.length)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={skip === 0}
                onClick={() => setSkip(Math.max(0, skip - limit))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filtered.length < limit}
                onClick={() => setSkip(skip + limit)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

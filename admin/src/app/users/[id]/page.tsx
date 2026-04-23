"use client";

import { useEffect, useState, use } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

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

interface ApiLog {
  id: string;
  user_id: string;
  provider: string;
  model: string;
  call_type: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  credits_used: number;
  latency_ms: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  reason: string;
  description: string | null;
  created_at: string;
}

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantDesc, setGrantDesc] = useState("");
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [userData, logsData, txData] = await Promise.all([
          apiGet<User[]>(`/api/v1/admin/users?skip=0&limit=1000`).then(
            (users) => {
              const found = users.find((u) => u.id === id);
              if (!found) throw new Error("User not found");
              return found;
            }
          ),
          apiGet<ApiLog[]>(
            `/api/v1/admin/api-logs?user_id=${id}&skip=0&limit=50`
          ),
          apiGet<Transaction[]>(
            `/api/v1/admin/credits/transactions?user_id=${id}&skip=0&limit=50`
          ),
        ]);
        setUser(userData);
        setLogs(logsData);
        setTransactions(txData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [id]);

  async function handleGrant() {
    if (!grantAmount) return;
    setGranting(true);
    try {
      await apiPost("/api/v1/admin/credits/grant", {
        user_id: id,
        amount: Number(grantAmount),
        reason: grantReason || "admin_grant",
        description: grantDesc || undefined,
      });
      setGrantAmount("");
      setGrantReason("");
      setGrantDesc("");
      // Refresh transactions
      const txData = await apiGet<Transaction[]>(
        `/api/v1/admin/credits/transactions?user_id=${id}&skip=0&limit=50`
      );
      setTransactions(txData);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to grant credits");
    } finally {
      setGranting(false);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading user...</div>;
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-semibold">{user.email}</h1>
      </div>

      {/* User info cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <div className="text-xs text-muted-foreground">Plan</div>
            <CardTitle>{user.plan || "Free"}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <div className="text-xs text-muted-foreground">Balance</div>
            <CardTitle>{user.balance.toLocaleString()} credits</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <div className="text-xs text-muted-foreground">Role</div>
            <CardTitle>{user.role}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <div className="text-xs text-muted-foreground">Status</div>
            <CardTitle>
              <Badge variant={user.is_active ? "default" : "destructive"}>
                {user.is_active ? "Active" : "Inactive"}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Grant credits */}
      <Card>
        <CardHeader>
          <CardTitle>Grant Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                type="number"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="1000"
                className="w-32"
              />
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Input
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="admin_grant"
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                value={grantDesc}
                onChange={(e) => setGrantDesc(e.target.value)}
                placeholder="Optional note"
                className="w-48"
              />
            </div>
            <Button onClick={handleGrant} disabled={granting || !grantAmount}>
              {granting ? "Granting..." : "Grant"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: API Logs & Transactions */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="api-logs">API Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    {new Date(tx.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tx.type}</Badge>
                  </TableCell>
                  <TableCell
                    className={
                      tx.amount >= 0 ? "text-green-600" : "text-red-600"
                    }
                  >
                    {tx.amount >= 0 ? "+" : ""}
                    {tx.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>{tx.reason}</TableCell>
                  <TableCell>{tx.description || "-"}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No transactions
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="api-logs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{log.provider}</TableCell>
                  <TableCell>{log.model}</TableCell>
                  <TableCell className="text-right">
                    {log.total_tokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {log.credits_used}
                  </TableCell>
                  <TableCell className="text-right">
                    {log.latency_ms}ms
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.status === "success" ? "default" : "destructive"
                      }
                    >
                      {log.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No API logs
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

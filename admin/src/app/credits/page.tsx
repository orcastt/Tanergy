"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  reason: string;
  description: string | null;
  created_at: string;
}

export default function CreditsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [skip, setSkip] = useState(0);
  const limit = 50;

  // Grant dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantDesc, setGrantDesc] = useState("");
  const [granting, setGranting] = useState(false);

  function fetchTransactions() {
    setLoading(true);
    apiGet<Transaction[]>(
      `/api/v1/admin/credits/transactions?skip=${skip}&limit=${limit}`
    )
      .then(setTransactions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  async function handleGrant() {
    if (!grantUserId || !grantAmount) return;
    setGranting(true);
    try {
      await apiPost("/api/v1/admin/credits/grant", {
        user_id: grantUserId,
        amount: Number(grantAmount),
        reason: grantReason || "admin_grant",
        description: grantDesc || undefined,
      });
      setDialogOpen(false);
      setGrantUserId("");
      setGrantAmount("");
      setGrantReason("");
      setGrantDesc("");
      fetchTransactions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to grant credits");
    } finally {
      setGranting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Credits</h1>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="size-4" />
          Grant Credits
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Grant Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Credits</DialogTitle>
            <DialogDescription>
              Add credits to a user&apos;s balance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>User ID</Label>
              <Input
                value={grantUserId}
                onChange={(e) => setGrantUserId(e.target.value)}
                placeholder="User UUID"
              />
            </div>
            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input
                type="number"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="1000"
              />
            </div>
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Input
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="admin_grant"
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={grantDesc}
                onChange={(e) => setGrantDesc(e.target.value)}
                placeholder="Optional note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGrant}
              disabled={granting || !grantUserId || !grantAmount}
            >
              {granting ? "Granting..." : "Grant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transactions Table */}
      {loading ? (
        <div className="text-muted-foreground">Loading transactions...</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
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
                  <TableCell className="max-w-32 truncate font-mono text-xs">
                    {tx.user_id}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tx.type}</Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      tx.amount >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {tx.amount >= 0 ? "+" : ""}
                    {tx.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>{tx.reason}</TableCell>
                  <TableCell className="max-w-48 truncate">
                    {tx.description || "-"}
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No transactions
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {skip + 1}-{skip + transactions.length}
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
                disabled={transactions.length < limit}
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

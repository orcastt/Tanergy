"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function ApiLogsPage() {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [skip, setSkip] = useState(0);
  const [provider, setProvider] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const limit = 50;

  function buildUrl() {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (provider && provider !== "all") params.set("provider", provider);
    if (status && status !== "all") params.set("status", status);
    return `/api/v1/admin/api-logs?${params}`;
  }

  function fetchLogs() {
    setLoading(true);
    apiGet<ApiLog[]>(buildUrl())
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, provider, status]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">API Logs</h1>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Provider:</span>
          <Select value={provider} onValueChange={(v) => { setProvider(v ?? ""); setSkip(0); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="google">Google</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={status} onValueChange={(v) => { setStatus(v ?? ""); setSkip(0); }}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">Loading logs...</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Prompt Tokens</TableHead>
                <TableHead className="text-right">Comp. Tokens</TableHead>
                <TableHead className="text-right">Total Tokens</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="max-w-24 truncate text-xs font-mono">
                    {log.user_id}
                  </TableCell>
                  <TableCell>{log.provider}</TableCell>
                  <TableCell>{log.model}</TableCell>
                  <TableCell className="text-right">
                    {log.prompt_tokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {log.completion_tokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {log.total_tokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">{log.credits_used}</TableCell>
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
                    colSpan={10}
                    className="text-center text-muted-foreground"
                  >
                    No logs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {skip + 1}-{skip + logs.length}
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
                disabled={logs.length < limit}
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

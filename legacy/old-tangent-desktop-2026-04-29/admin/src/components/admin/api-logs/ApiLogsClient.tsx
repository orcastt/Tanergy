"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { ApiLog, ApiLogDetail } from "@/lib/admin-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiLogDetailDialog } from "./ApiLogDetailDialog";

const limit = 50;

export function ApiLogsClient() {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [skip, setSkip] = useState(0);
  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<ApiLogDetail | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<ApiLog[]>(buildLogsUrl(skip, provider, status))
      .then((data) => {
        if (active) setLogs(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [skip, provider, status]);

  async function openDetail(id: string) {
    setDetail(await apiGet<ApiLogDetail>(`/api/v1/admin/api-logs/${id}`));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API 调用日志</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看模型调用、耗时、错误、退款和上游任务信息。</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Filter label="Provider" value={provider} onChange={(value) => { setProvider(value); setSkip(0); }} />
        <Filter label="状态" value={status} onChange={(value) => { setStatus(value); setSkip(0); }} />
      </div>

      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-muted-foreground">正在加载日志...</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead className="text-right">积分</TableHead>
                <TableHead className="text-right">耗时</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{new Date(log.created_at).toLocaleString()}</TableCell>
                  <TableCell>{log.provider}</TableCell>
                  <TableCell className="max-w-64 truncate font-mono text-xs">{log.model}</TableCell>
                  <TableCell className="text-xs">{log.endpoint ?? "-"}</TableCell>
                  <TableCell className="text-right">{log.credits_used}</TableCell>
                  <TableCell className="text-right">{log.latency_ms}ms</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "success" ? "default" : "destructive"}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="xs" variant="outline" onClick={() => openDetail(log.id)}>详情</Button>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">没有日志</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">显示 {skip + 1}-{skip + logs.length}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - limit))}>上一页</Button>
              <Button variant="outline" size="sm" disabled={logs.length < limit} onClick={() => setSkip(skip + limit)}>下一页</Button>
            </div>
          </div>
        </>
      )}

      <ApiLogDetailDialog detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function buildLogsUrl(skip: number, provider: string, status: string) {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (provider !== "all") params.set("provider", provider);
  if (status !== "all") params.set("status", status);
  return `/api/v1/admin/api-logs?${params}`;
}

function Filter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = label === "Provider" ? ["all", "geekai", "openai", "anthropic", "google"] : ["all", "success", "error"];
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <Select value={value} onValueChange={(next) => onChange(next ?? "all")}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

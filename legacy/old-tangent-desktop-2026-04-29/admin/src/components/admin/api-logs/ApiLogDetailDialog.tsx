"use client";

import { JsonPreview } from "@/components/admin/JsonPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiLogDetail } from "@/lib/admin-types";

interface ApiLogDetailDialogProps {
  detail: ApiLogDetail | null;
  onClose: () => void;
}

export function ApiLogDetailDialog({ detail, onClose }: ApiLogDetailDialogProps) {
  const log = detail?.log;
  return (
    <Dialog open={!!detail} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>调用详情</DialogTitle>
          <DialogDescription>查看脱敏请求摘要、响应摘要、task id 和退款关联。</DialogDescription>
        </DialogHeader>

        {log && (
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <section className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={log.status === "success" ? "default" : "destructive"}>{log.status}</Badge>
                <Badge variant="outline">{log.call_type}</Badge>
                {log.error_code && <Badge variant="destructive">{log.error_code}</Badge>}
              </div>
              <Meta label="用户" value={detail?.user_email ?? log.user_id} />
              <Meta label="模型" value={`${log.provider}/${log.model}`} />
              <Meta label="Endpoint" value={log.endpoint ?? "-"} />
              <Meta label="Task ID" value={log.upstream_task_id ?? "-"} />
              <Meta label="退款流水" value={log.refund_transaction_id ?? "-"} />
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                <Metric label="积分" value={log.credits_used} />
                <Metric label="耗时" value={`${log.latency_ms}ms`} />
                <Metric label="Tokens" value={log.total_tokens} />
              </div>
              {log.error_message && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{log.error_message}</div>
              )}
            </section>

            <section className="space-y-3">
              <JsonBlock title="请求摘要" value={log.request_params} />
              <JsonBlock title="响应摘要" value={log.response_meta} />
              <JsonBlock title="上游成本" value={log.upstream_cost} />
            </section>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-mono text-xs">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
      <JsonPreview value={value} maxHeight="max-h-48" />
    </div>
  );
}

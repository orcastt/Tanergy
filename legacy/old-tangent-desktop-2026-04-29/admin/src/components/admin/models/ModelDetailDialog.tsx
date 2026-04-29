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
import type { ModelDetail, TestResult } from "@/lib/admin-types";

interface ModelDetailDialogProps {
  detail: ModelDetail | null;
  testResult: TestResult | null;
  testing: boolean;
  onClose: () => void;
  onTest: (execute: boolean) => void;
}

export function ModelDetailDialog({
  detail,
  testResult,
  testing,
  onClose,
  onTest,
}: ModelDetailDialogProps) {
  const model = detail?.model;
  return (
    <Dialog open={!!detail} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{model?.display_name ?? "模型详情"}</DialogTitle>
          <DialogDescription>
            查看模型能力、参数、价格口径和最低成本测试结果。
          </DialogDescription>
        </DialogHeader>

        {detail && (
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <section className="space-y-3">
              <Meta label="模型 ID" value={detail.model.model} />
              <Meta label="Provider" value={detail.model.provider} />
              <Meta label="Endpoint" value={detail.model.endpoint_type ?? "-"} />
              <div className="flex flex-wrap gap-2">
                <Badge variant={detail.model.is_active ? "default" : "destructive"}>
                  {detail.model.is_active ? "启用" : "停用"}
                </Badge>
                {detail.model.is_default && <Badge variant="secondary">默认模型</Badge>}
                <Badge variant="outline">{detail.model.call_type}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                <Metric label="调用量" value={detail.usage.total_calls} />
                <Metric label="成功率" value={`${Math.round(detail.usage.success_rate * 100)}%`} />
                <Metric label="平均耗时" value={`${detail.usage.avg_latency_ms}ms`} />
              </div>
              <JsonPreview value={detail.model.smoke_test_payload} maxHeight="max-h-48" />
            </section>

            <section className="space-y-3">
              <JsonBlock title="参数 Schema" value={detail.model.parameter_schema} />
              <JsonBlock title="价格 Schema" value={detail.model.pricing_schema} />
              <JsonBlock title="能力" value={detail.model.capabilities} />
            </section>
          </div>
        )}

        {testResult && (
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              测试结果
              <Badge variant={testResult.ok ? "default" : "destructive"}>
                {testResult.ok ? "成功" : "失败"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {testResult.execute ? "真实请求" : "Dry-run"} · {testResult.latency_ms}ms
              </span>
            </div>
            <JsonPreview value={testResult} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
          <Button variant="secondary" disabled={testing} onClick={() => onTest(false)}>
            Dry-run
          </Button>
          <Button disabled={testing} onClick={() => onTest(true)}>
            {testing ? "测试中..." : "真实测试"}
          </Button>
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
      <JsonPreview value={value} maxHeight="max-h-40" />
    </div>
  );
}

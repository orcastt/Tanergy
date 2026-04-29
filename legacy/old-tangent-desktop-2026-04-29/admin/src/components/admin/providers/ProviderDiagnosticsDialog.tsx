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
import type { ProviderHealth, TestResult } from "@/lib/admin-types";

interface ProviderDiagnosticsDialogProps {
  health: ProviderHealth | null;
  testResult: TestResult | null;
  testing: boolean;
  onClose: () => void;
  onTest: (execute: boolean) => void;
}

export function ProviderDiagnosticsDialog({
  health,
  testResult,
  testing,
  onClose,
  onTest,
}: ProviderDiagnosticsDialogProps) {
  return (
    <Dialog open={!!health} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{health?.provider.name ?? "线路诊断"}</DialogTitle>
          <DialogDescription>检查 Provider 配置、Key 状态，并执行最低成本模型测试。</DialogDescription>
        </DialogHeader>

        {health && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
              <Meta label="Provider ID" value={health.provider.id} />
              <Meta label="Key Env" value={health.key_env} />
              <Meta label="Base URL" value={health.base_url} />
              <div>
                <div className="text-xs text-muted-foreground">状态</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant={health.ready ? "default" : "destructive"}>
                    {health.ready ? "可用" : "需检查"}
                  </Badge>
                  <Badge variant={health.key_configured ? "secondary" : "destructive"}>
                    {health.key_configured ? "Key 已配置" : "Key 未配置"}
                  </Badge>
                </div>
              </div>
            </div>
            {health.issues.length > 0 && (
              <JsonPreview value={{ issues: health.issues }} maxHeight="max-h-32" />
            )}
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
          <Button variant="secondary" disabled={testing} onClick={() => onTest(false)}>Dry-run</Button>
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

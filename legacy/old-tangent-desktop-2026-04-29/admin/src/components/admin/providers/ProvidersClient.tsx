"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiDel, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Provider, ProviderHealth, TestResult } from "@/lib/admin-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  emptyProviderForm,
  ProviderDialog,
  type ProviderForm,
} from "./ProviderDialog";
import { ProviderDiagnosticsDialog } from "./ProviderDiagnosticsDialog";

export function ProvidersClient() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProviderForm>(emptyProviderForm);
  const [editing, setEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState<ProviderHealth | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  function fetchProviders() {
    setLoading(true);
    apiGet<Provider[]>("/api/v1/admin/providers")
      .then(setProviders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    apiGet<Provider[]>("/api/v1/admin/providers")
      .then((data) => {
        if (active) setProviders(data);
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
  }, []);

  function openCreate() {
    setForm(emptyProviderForm);
    setEditing(false);
    setDialogOpen(true);
  }

  function openEdit(provider: Provider) {
    setForm({
      id: provider.id,
      name: provider.name,
      base_url: provider.base_url,
      key_env: provider.key_env,
      auth_style: provider.auth_style,
      extra_headers: provider.extra_headers ? JSON.stringify(provider.extra_headers, null, 2) : "",
      is_active: provider.is_active,
    });
    setEditing(true);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      payload.extra_headers = form.extra_headers.trim() ? JSON.parse(form.extra_headers) : null;
      if (editing) await apiPatch(`/api/v1/admin/providers/${form.id}`, payload);
      else await apiPost("/api/v1/admin/providers", payload);
      setDialogOpen(false);
      fetchProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function removeProvider(id: string) {
    if (!window.confirm("确认删除这个线路吗？")) return;
    await apiDel(`/api/v1/admin/providers/${id}`);
    fetchProviders();
  }

  async function openDiagnostics(providerId: string) {
    setTestResult(null);
    setHealth(await apiGet<ProviderHealth>(`/api/v1/admin/providers/${providerId}/health`));
  }

  async function runTest(execute: boolean) {
    if (!health) return;
    if (execute && !window.confirm("真实测试会请求上游 API，可能消耗 GeekAI 额度。继续吗？")) return;
    setTesting(true);
    try {
      setTestResult(await apiPost<TestResult>(`/api/v1/admin/providers/${health.provider.id}/test`, { execute }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "测试失败");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">线路管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理官方 Provider、环境变量 key 和健康检查。</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="size-4" />
          添加线路
        </Button>
      </div>

      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-muted-foreground">正在加载线路...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>线路</TableHead>
              <TableHead>Base URL</TableHead>
              <TableHead>Key Env</TableHead>
              <TableHead>认证</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((provider) => (
              <TableRow key={provider.id}>
                <TableCell>
                  <div className="font-medium">{provider.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{provider.id}</div>
                </TableCell>
                <TableCell className="max-w-64 truncate text-xs">{provider.base_url}</TableCell>
                <TableCell className="font-mono text-xs">{provider.key_env}</TableCell>
                <TableCell>{provider.auth_style}</TableCell>
                <TableCell>
                  <Badge variant={provider.is_active ? "default" : "destructive"}>
                    {provider.is_active ? "启用" : "停用"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="xs" variant="outline" onClick={() => openDiagnostics(provider.id)}>诊断</Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => openEdit(provider)}><Pencil className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => removeProvider(provider.id)}><Trash2 className="size-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ProviderDialog open={dialogOpen} editing={editing} saving={saving} form={form} onOpenChange={setDialogOpen} onFormChange={setForm} onSave={handleSave} />
      <ProviderDiagnosticsDialog health={health} testResult={testResult} testing={testing} onClose={() => setHealth(null)} onTest={runTest} />
    </div>
  );
}

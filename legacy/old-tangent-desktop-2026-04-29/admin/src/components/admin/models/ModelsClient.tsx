"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { apiDel, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Model, ModelDetail, TestResult } from "@/lib/admin-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ModelDetailDialog } from "./ModelDetailDialog";
import { emptyModelForm, ModelDialog, type ModelForm } from "./ModelDialog";

export function ModelsClient() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ModelForm>(emptyModelForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState("");
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  function fetchModels() {
    setLoading(true);
    apiGet<Model[]>("/api/v1/admin/models")
      .then(setModels)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    apiGet<Model[]>("/api/v1/admin/models")
      .then((data) => {
        if (active) setModels(data);
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

  async function handleSave() {
    setSaving(true);
    try {
      await apiPost("/api/v1/admin/models", {
        ...form,
        credits_per_call: Number(form.credits_per_call),
        credits_per_1k_tokens: Number(form.credits_per_1k_tokens),
        max_tokens: Number(form.max_tokens),
      });
      setDialogOpen(false);
      setForm(emptyModelForm);
      fetchModels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function patchModel(id: string, updates: Record<string, unknown>) {
    await apiPatch(`/api/v1/admin/models/${id}`, updates);
    fetchModels();
  }

  async function setDefaultModel(id: string) {
    await apiPost(`/api/v1/admin/models/${id}/set-default`);
    fetchModels();
  }

  async function showDetail(id: string) {
    setTestResult(null);
    setDetail(await apiGet<ModelDetail>(`/api/v1/admin/models/${id}`));
  }

  async function runTest(execute: boolean) {
    if (!detail) return;
    if (execute && !window.confirm("真实测试会请求上游 API，可能消耗 GeekAI 额度。继续吗？")) return;
    setTesting(true);
    try {
      setTestResult(await apiPost<TestResult>(`/api/v1/admin/models/${detail.model.id}/test`, { execute }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "测试失败");
    } finally {
      setTesting(false);
    }
  }

  async function removeModel(id: string) {
    if (!window.confirm("确认删除这个模型吗？")) return;
    await apiDel(`/api/v1/admin/models/${id}`);
    fetchModels();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">模型管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">配置模型、积分、能力参数与最低成本测试。</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="size-4" />
          添加模型
        </Button>
      </div>

      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-muted-foreground">正在加载模型...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>模型</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead className="text-right">积分/次</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.id}>
                <TableCell>
                  <div className="font-medium">{model.display_name}</div>
                  <div className="mt-1 max-w-80 truncate font-mono text-xs text-muted-foreground">
                    {model.provider}/{model.model}
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{model.call_type}</Badge></TableCell>
                <TableCell className="text-xs">{model.endpoint_type ?? "-"}</TableCell>
                <TableCell className="text-right">
                  {editingId === model.id ? (
                    <Input className="ml-auto w-20 text-right" value={editCredits} onChange={(event) => setEditCredits(event.target.value)} />
                  ) : (
                    model.credits_per_call
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={model.is_active ? "default" : "destructive"}>{model.is_active ? "启用" : "停用"}</Badge>
                    {model.is_default && <Badge variant="secondary">默认</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {editingId === model.id ? (
                      <>
                        <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>取消</Button>
                        <Button size="xs" onClick={() => { void patchModel(model.id, { credits_per_call: Number(editCredits) }); setEditingId(null); }}>保存</Button>
                      </>
                    ) : (
                      <>
                        <Button size="xs" variant="outline" onClick={() => showDetail(model.id)}>详情</Button>
                        {!model.is_default && <Button size="xs" variant="ghost" onClick={() => setDefaultModel(model.id)}>设默认</Button>}
                        <Button size="xs" variant="ghost" onClick={() => { setEditingId(model.id); setEditCredits(String(model.credits_per_call)); }}>积分</Button>
                        <Button size="xs" variant="ghost" onClick={() => patchModel(model.id, { is_active: !model.is_active })}>{model.is_active ? "停用" : "启用"}</Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => removeModel(model.id)}><Trash2 className="size-3.5" /></Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ModelDialog open={dialogOpen} form={form} saving={saving} onOpenChange={setDialogOpen} onFormChange={setForm} onSave={handleSave} />
      <ModelDetailDialog detail={detail} testResult={testResult} testing={testing} onClose={() => setDetail(null)} onTest={runTest} />
    </div>
  );
}

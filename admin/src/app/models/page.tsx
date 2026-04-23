"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDel } from "@/lib/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

interface Model {
  id: string;
  provider: string;
  model: string;
  display_name: string;
  call_type: string;
  is_active: boolean;
  credits_per_call: number;
  credits_per_1k_tokens: number;
  max_tokens: number;
}

interface ModelForm {
  provider: string;
  model: string;
  display_name: string;
  call_type: string;
  is_active: boolean;
  credits_per_call: string;
  credits_per_1k_tokens: string;
  max_tokens: string;
}

const emptyForm: ModelForm = {
  provider: "",
  model: "",
  display_name: "",
  call_type: "chat",
  is_active: true,
  credits_per_call: "0",
  credits_per_1k_tokens: "0",
  max_tokens: "4096",
};

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ModelForm>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCreditsPerCall, setEditCreditsPerCall] = useState("");
  const [editCreditsPer1k, setEditCreditsPer1k] = useState("");

  function fetchModels() {
    setLoading(true);
    apiGet<Model[]>("/api/v1/admin/models")
      .then(setModels)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchModels();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        provider: form.provider,
        model: form.model,
        display_name: form.display_name,
        call_type: form.call_type,
        is_active: form.is_active,
        credits_per_call: Number(form.credits_per_call),
        credits_per_1k_tokens: Number(form.credits_per_1k_tokens),
        max_tokens: Number(form.max_tokens),
      };
      await apiPost("/api/v1/admin/models", payload);
      setDialogOpen(false);
      setForm(emptyForm);
      fetchModels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleInlineSave(id: string) {
    try {
      await apiPatch(`/api/v1/admin/models/${id}`, {
        credits_per_call: Number(editCreditsPerCall),
        credits_per_1k_tokens: Number(editCreditsPer1k),
      });
      setEditingId(null);
      fetchModels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    }
  }

  function startInlineEdit(m: Model) {
    setEditingId(m.id);
    setEditCreditsPerCall(String(m.credits_per_call));
    setEditCreditsPer1k(String(m.credits_per_1k_tokens));
  }

  async function handleToggleActive(m: Model) {
    try {
      await apiPatch(`/api/v1/admin/models/${m.id}`, {
        is_active: !m.is_active,
      });
      setModels((prev) =>
        prev.map((x) =>
          x.id === m.id ? { ...x, is_active: !x.is_active } : x
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiDel(`/api/v1/admin/models/${deleteId}`);
      setDeleteId(null);
      fetchModels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Models</h1>
        <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }} size="sm">
          <Plus className="size-4" />
          Add Model
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add Model Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Model</DialogTitle>
            <DialogDescription>
              Register a new model for the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Provider</Label>
                <Input
                  value={form.provider}
                  onChange={(e) =>
                    setForm({ ...form, provider: e.target.value })
                  }
                  placeholder="openai"
                />
              </div>
              <div className="grid gap-2">
                <Label>Model ID</Label>
                <Input
                  value={form.model}
                  onChange={(e) =>
                    setForm({ ...form, model: e.target.value })
                  }
                  placeholder="gpt-4o"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Display Name</Label>
              <Input
                value={form.display_name}
                onChange={(e) =>
                  setForm({ ...form, display_name: e.target.value })
                }
                placeholder="GPT-4o"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Call Type</Label>
                <Select
                  value={form.call_type}
                  onValueChange={(v) => setForm({ ...form, call_type: v ?? "" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chat">Chat</SelectItem>
                    <SelectItem value="completion">Completion</SelectItem>
                    <SelectItem value="embedding">Embedding</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Max Tokens</Label>
                <Input
                  type="number"
                  value={form.max_tokens}
                  onChange={(e) =>
                    setForm({ ...form, max_tokens: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Credits / Call</Label>
                <Input
                  type="number"
                  value={form.credits_per_call}
                  onChange={(e) =>
                    setForm({ ...form, credits_per_call: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Credits / 1K Tokens</Label>
                <Input
                  type="number"
                  value={form.credits_per_1k_tokens}
                  onChange={(e) =>
                    setForm({ ...form, credits_per_1k_tokens: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Add Model"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Model</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this model? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      {loading ? (
        <div className="text-muted-foreground">Loading models...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Call Type</TableHead>
              <TableHead className="text-right">Credits/Call</TableHead>
              <TableHead className="text-right">Credits/1K Tokens</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.provider}</TableCell>
                <TableCell className="font-mono text-xs">{m.model}</TableCell>
                <TableCell className="font-medium">{m.display_name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{m.call_type}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {editingId === m.id ? (
                    <Input
                      type="number"
                      value={editCreditsPerCall}
                      onChange={(e) => setEditCreditsPerCall(e.target.value)}
                      className="w-20 text-right"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:underline"
                      onClick={() => startInlineEdit(m)}
                    >
                      {m.credits_per_call}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === m.id ? (
                    <Input
                      type="number"
                      value={editCreditsPer1k}
                      onChange={(e) => setEditCreditsPer1k(e.target.value)}
                      className="w-20 text-right"
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:underline"
                      onClick={() => startInlineEdit(m)}
                    >
                      {m.credits_per_1k_tokens}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleToggleActive(m)}
                    className="cursor-pointer"
                  >
                    <Badge variant={m.is_active ? "default" : "destructive"}>
                      {m.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {editingId === m.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="xs"
                          onClick={() => handleInlineSave(m.id)}
                        >
                          Save
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeleteId(m.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {models.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground"
                >
                  No models configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

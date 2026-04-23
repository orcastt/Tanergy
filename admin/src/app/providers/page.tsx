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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  base_url: string;
  key_env: string;
  auth_style: string;
  extra_headers: Record<string, string> | null;
  is_active: boolean;
  created_at: string;
}

interface ProviderForm {
  id: string;
  name: string;
  base_url: string;
  key_env: string;
  auth_style: string;
  extra_headers: string;
  is_active: boolean;
}

const emptyForm: ProviderForm = {
  id: "",
  name: "",
  base_url: "",
  key_env: "",
  auth_style: "bearer",
  extra_headers: "",
  is_active: true,
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProviderForm>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function fetchProviders() {
    setLoading(true);
    apiGet<Provider[]>("/api/v1/admin/providers")
      .then(setProviders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchProviders();
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setEditing(false);
    setDialogOpen(true);
  }

  function openEdit(p: Provider) {
    setForm({
      id: p.id,
      name: p.name,
      base_url: p.base_url,
      key_env: p.key_env,
      auth_style: p.auth_style,
      extra_headers: p.extra_headers
        ? JSON.stringify(p.extra_headers, null, 2)
        : "",
      is_active: p.is_active,
    });
    setEditing(true);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        id: form.id,
        name: form.name,
        base_url: form.base_url,
        key_env: form.key_env,
        auth_style: form.auth_style,
        is_active: form.is_active,
      };
      if (form.extra_headers.trim()) {
        payload.extra_headers = JSON.parse(form.extra_headers);
      }
      if (editing) {
        await apiPatch(`/api/v1/admin/providers/${form.id}`, payload);
      } else {
        await apiPost("/api/v1/admin/providers", payload);
      }
      setDialogOpen(false);
      fetchProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiDel(`/api/v1/admin/providers/${deleteId}`);
      setDeleteId(null);
      fetchProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Providers</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="size-4" />
          Add Provider
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Provider" : "Add Provider"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update provider configuration."
                : "Configure a new AI provider."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Provider ID</Label>
              <Input
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                disabled={editing}
                placeholder="openai"
              />
            </div>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="OpenAI"
              />
            </div>
            <div className="grid gap-2">
              <Label>Base URL</Label>
              <Input
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div className="grid gap-2">
              <Label>Key Env Var</Label>
              <Input
                value={form.key_env}
                onChange={(e) => setForm({ ...form, key_env: e.target.value })}
                placeholder="OPENAI_API_KEY"
              />
            </div>
            <div className="grid gap-2">
              <Label>Auth Style</Label>
              <Select
                value={form.auth_style}
                onValueChange={(v) => setForm({ ...form, auth_style: v ?? "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bearer">Bearer</SelectItem>
                  <SelectItem value="x-api-key">X-API-Key</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Extra Headers (JSON)</Label>
              <Input
                value={form.extra_headers}
                onChange={(e) =>
                  setForm({ ...form, extra_headers: e.target.value })
                }
                placeholder='{"X-Custom": "value"}'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this provider? This action cannot
              be undone.
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
        <div className="text-muted-foreground">Loading providers...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Base URL</TableHead>
              <TableHead>Auth Style</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.id}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="max-w-48 truncate text-xs">
                  {p.base_url}
                </TableCell>
                <TableCell>{p.auth_style}</TableCell>
                <TableCell>
                  <Badge variant={p.is_active ? "default" : "destructive"}>
                    {p.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeleteId(p.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {providers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  No providers configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

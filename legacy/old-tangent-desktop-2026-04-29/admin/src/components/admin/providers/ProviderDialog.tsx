"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ProviderForm {
  id: string;
  name: string;
  base_url: string;
  key_env: string;
  auth_style: string;
  extra_headers: string;
  is_active: boolean;
}

export const emptyProviderForm: ProviderForm = {
  id: "",
  name: "",
  base_url: "",
  key_env: "",
  auth_style: "bearer",
  extra_headers: "",
  is_active: true,
};

interface ProviderDialogProps {
  open: boolean;
  editing: boolean;
  saving: boolean;
  form: ProviderForm;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: ProviderForm) => void;
  onSave: () => void;
}

export function ProviderDialog({
  open,
  editing,
  saving,
  form,
  onOpenChange,
  onFormChange,
  onSave,
}: ProviderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑线路" : "添加线路"}</DialogTitle>
          <DialogDescription>配置官方后端代理线路，不在前端暴露真实 key。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="Provider ID" value={form.id} disabled={editing} onChange={(id) => onFormChange({ ...form, id })} />
          <Field label="名称" value={form.name} onChange={(name) => onFormChange({ ...form, name })} />
          <Field label="Base URL" value={form.base_url} onChange={(base_url) => onFormChange({ ...form, base_url })} />
          <Field label="Key Env" value={form.key_env} onChange={(key_env) => onFormChange({ ...form, key_env })} />
          <div className="grid gap-2">
            <Label>认证方式</Label>
            <Select value={form.auth_style} onValueChange={(auth_style) => onFormChange({ ...form, auth_style: auth_style ?? "" })}>
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
          <Field
            label="Extra Headers JSON"
            value={form.extra_headers}
            onChange={(extra_headers) => onFormChange({ ...form, extra_headers })}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

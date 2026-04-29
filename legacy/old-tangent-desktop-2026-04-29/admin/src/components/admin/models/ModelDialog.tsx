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

export interface ModelForm {
  provider: string;
  model: string;
  display_name: string;
  call_type: string;
  is_active: boolean;
  credits_per_call: string;
  credits_per_1k_tokens: string;
  max_tokens: string;
}

export const emptyModelForm: ModelForm = {
  provider: "",
  model: "",
  display_name: "",
  call_type: "chat",
  is_active: true,
  credits_per_call: "0",
  credits_per_1k_tokens: "0",
  max_tokens: "4096",
};

interface ModelDialogProps {
  open: boolean;
  form: ModelForm;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: ModelForm) => void;
  onSave: () => void;
}

export function ModelDialog({
  open,
  form,
  saving,
  onOpenChange,
  onFormChange,
  onSave,
}: ModelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加模型</DialogTitle>
          <DialogDescription>注册新的官方模型线路。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider" value={form.provider} onChange={(provider) => onFormChange({ ...form, provider })} />
            <Field label="Model ID" value={form.model} onChange={(model) => onFormChange({ ...form, model })} />
          </div>
          <Field
            label="显示名称"
            value={form.display_name}
            onChange={(display_name) => onFormChange({ ...form, display_name })}
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>调用类型</Label>
              <Select value={form.call_type} onValueChange={(call_type) => onFormChange({ ...form, call_type: call_type ?? "" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat">Chat</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="image_chat">Image Chat</SelectItem>
                  <SelectItem value="image_edit">Image Edit</SelectItem>
                  <SelectItem value="image_enhance">Image Enhance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="Max Tokens" type="number" value={form.max_tokens} onChange={(max_tokens) => onFormChange({ ...form, max_tokens })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="积分/次" type="number" value={form.credits_per_call} onChange={(credits_per_call) => onFormChange({ ...form, credits_per_call })} />
            <Field label="积分/1K tokens" type="number" value={form.credits_per_1k_tokens} onChange={(credits_per_1k_tokens) => onFormChange({ ...form, credits_per_1k_tokens })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "保存中..." : "添加模型"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

interface JsonPreviewProps {
  value: unknown;
  maxHeight?: string;
}

export function JsonPreview({ value, maxHeight = "max-h-64" }: JsonPreviewProps) {
  return (
    <pre
      className={`${maxHeight} overflow-auto rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground`}
    >
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}

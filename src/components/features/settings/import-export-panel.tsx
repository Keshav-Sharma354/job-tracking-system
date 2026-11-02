"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/layout";
import { Select } from "@/components/ui/input";

const EXPORT_ENTITIES = [
  { value: "applications", label: "Applications" },
  { value: "contacts", label: "Contacts" },
  { value: "tasks", label: "Follow-ups" },
  { value: "notes", label: "Notes" },
] as const;

const IMPORT_ENTITIES = [
  { value: "applications", label: "Applications" },
  { value: "contacts", label: "Contacts" },
] as const;

interface ImportResponse {
  created: number;
  skipped: number;
  errors: string[];
  message: string;
}

/** CSV download and upload, wired to `/api/export`. */
export function ImportExportPanel() {
  const router = useRouter();
  const [exportEntity, setExportEntity] = React.useState("applications");
  const [importEntity, setImportEntity] = React.useState("applications");
  const [uploading, setUploading] = React.useState(false);
  const [result, setResult] = React.useState<ImportResponse | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch(`/api/export?entity=${importEntity}`, {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as ImportResponse & { error?: string };

      if (!response.ok && !payload.created) {
        setResult({
          created: 0,
          skipped: 0,
          errors: [payload.error ?? "Import failed"],
          message: "Nothing was imported",
        });
        return;
      }

      setResult(payload);
      if (payload.created > 0) router.refresh();
    } catch (error) {
      console.error("Import failed", error);
      setResult({
        created: 0,
        skipped: 0,
        errors: ["The upload failed. Check your connection and try again."],
        message: "Import failed",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Import & export"
        description="Move your data in and out as CSV"
      />
      <CardBody className="grid gap-6 sm:grid-cols-2">
        {/* Export */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Export</p>
          <p className="text-xs text-muted">
            Downloads every record you own in that category. Columns match what
            the importer expects, so an export can be edited and re-imported.
          </p>
          <div className="flex gap-2">
            <Select
              value={exportEntity}
              onChange={(event) => setExportEntity(event.target.value)}
              aria-label="What to export"
              className="w-auto flex-1"
            >
              {EXPORT_ENTITIES.map((entity) => (
                <option key={entity.value} value={entity.value}>
                  {entity.label}
                </option>
              ))}
            </Select>
            <Button asChild>
              <a href={`/api/export?entity=${exportEntity}`} download>
                <Download />
                Download
              </a>
            </Button>
          </div>
        </div>

        {/* Import */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Import</p>
          <p className="text-xs text-muted">
            Required columns: <code className="font-mono">company</code> and{" "}
            <code className="font-mono">title</code> for applications,{" "}
            <code className="font-mono">name</code> for contacts. Rows that fail
            validation are reported rather than silently dropped.
          </p>
          <div className="flex gap-2">
            <Select
              value={importEntity}
              onChange={(event) => setImportEntity(event.target.value)}
              aria-label="What to import"
              className="w-auto flex-1"
            >
              {IMPORT_ENTITIES.map((entity) => (
                <option key={entity.value} value={entity.value}>
                  {entity.label}
                </option>
              ))}
            </Select>
            <label
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover"
              aria-disabled={uploading}
            >
              <Upload className={uploading ? "animate-pulse" : undefined} />
              {uploading ? "Importing…" : "Choose file"}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </label>
          </div>

          {result ? (
            <div
              role="status"
              className="space-y-1.5 rounded-lg bg-surface-sunken p-3 text-xs"
            >
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                {result.created > 0 ? (
                  <CheckCircle2 className="size-3.5 text-success" />
                ) : (
                  <AlertCircle className="size-3.5 text-warning" />
                )}
                {result.message}
              </p>
              {result.errors.length > 0 ? (
                <ul className="max-h-32 space-y-0.5 overflow-y-auto text-muted">
                  {result.errors.slice(0, 20).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                  {result.errors.length > 20 ? (
                    <li className="text-subtle">
                      …and {result.errors.length - 20} more
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X, FileIcon } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface FileDropzoneProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  accept?: string;
  label?: string;
  disabled?: boolean;
}

/** Extensions whose files often arrive without a usable MIME type. */
const EXTENSION_MIME: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

/**
 * Convert an `<input accept>` string (MIME types and/or `.ext` tokens, as in
 * FILE_TYPE_CONFIGS) into react-dropzone's `{ mime: [exts] }` shape. Extension
 * tokens must be listed under a MIME key, never used as keys themselves.
 */
export function toDropzoneAccept(accept: string): Record<string, string[]> | undefined {
  const tokens = accept.split(",").map((token) => token.trim()).filter(Boolean);
  // `*/*` is not a MIME type react-dropzone accepts; no restriction is expressed as `undefined`.
  if (!tokens.length || tokens.includes("*/*")) return undefined;
  const mimes = tokens.filter((token) => token.includes("/"));
  const result: Record<string, string[]> = Object.fromEntries(mimes.map((mime) => [mime, []]));
  for (const ext of tokens.filter((token) => token.startsWith("."))) {
    const key = EXTENSION_MIME[ext.toLowerCase()] ?? mimes[0] ?? "application/octet-stream";
    (result[key] ??= []).push(ext);
  }
  return result;
}

export function FileDropzone({
  file,
  onFileSelect,
  onFileRemove,
  accept = "*/*",
  label,
  disabled = false,
}: FileDropzoneProps) {
  const { t } = useTranslation();
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: toDropzoneAccept(accept),
    multiple: false,
    disabled,
  });

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs">{label}</Label>}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200
          ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {file ? (
            <>
              <FileIcon className="h-8 w-8 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("upload.fileDropzone.fileSize", {
                    size: (file.size / 1024 / 1024).toFixed(2),
                  })}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileRemove();
                }}
                className="mt-2"
              >
                <X className="h-4 w-4 mr-1" />
                {t("upload.fileDropzone.removeFile")}
              </Button>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {isDragActive
                    ? t("upload.fileDropzone.dropActive")
                    : t("upload.fileDropzone.dropInactive")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("upload.fileDropzone.supports", { accept })}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

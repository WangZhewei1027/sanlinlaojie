import { useCallback } from "react";
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

export function FileDropzone({
  file,
  onFileSelect,
  onFileRemove,
  accept = "*/*",
  label,
  disabled = false,
}: FileDropzoneProps) {
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
    accept: accept
      .split(",")
      .reduce((acc, type) => ({ ...acc, [type.trim()]: [] }), {}),
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
                  {(file.size / 1024 / 1024).toFixed(2)} MB
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
                移除文件
              </Button>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {isDragActive
                    ? "松开以上传文件"
                    : "拖拽文件到这里，或点击选择"}
                </p>
                <p className="text-xs text-muted-foreground">支持: {accept}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface TextUploadProps {
  onUpload: (text: string) => Promise<void>;
  disabled: boolean;
}

export function TextUpload({ onUpload, disabled }: TextUploadProps) {
  const [textContent, setTextContent] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!textContent.trim()) return;

    setUploading(true);
    try {
      await onUpload(textContent);
      setTextContent("");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="text-content">文本内容</Label>
        <Textarea
          id="text-content"
          placeholder="输入要记录的文本信息..."
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          className="min-h-[120px]"
        />
      </div>
      <Button
        size="lg"
        className="w-full"
        onClick={handleUpload}
        disabled={uploading || !textContent.trim() || disabled}
      >
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            上传中...
          </>
        ) : (
          <>
            <Check className="h-5 w-5 mr-2" />
            上传文本
          </>
        )}
      </Button>
    </Card>
  );
}

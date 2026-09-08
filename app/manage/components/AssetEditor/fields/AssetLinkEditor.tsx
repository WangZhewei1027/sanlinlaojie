import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import { FieldLabel } from "../FieldLabel";

interface AssetLinkEditorProps {
  originalUrl: string;
  isEditing: boolean;
  editedLink: string;
  onLinkChange: (link: string) => void;
}

export function AssetLinkEditor({
  originalUrl,
  isEditing,
  editedLink,
  onLinkChange,
}: AssetLinkEditorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <FieldLabel>{t("linkAsset.fields.source")}</FieldLabel>
      {isEditing ? (
        <>
          <Textarea
            value={editedLink}
            onChange={(event) => onLinkChange(event.target.value)}
            placeholder={t("linkAsset.fields.placeholder")}
            rows={3}
          />
          <Text as="p" variant="bodySm" tone="subdued">
            {t("linkAsset.fields.hint")}
          </Text>
        </>
      ) : originalUrl ? (
        <Link
          href={originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md bg-muted/40 p-3 text-sm text-primary hover:underline"
        >
          <span className="min-w-0 flex-1 truncate">{originalUrl}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </Link>
      ) : (
        <Text as="p" variant="bodySm" tone="critical">
          {t("linkAsset.errors.invalidStoredUrl")}
        </Text>
      )}
    </div>
  );
}

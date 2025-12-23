interface AssetMetadataProps {
  metadata: Record<string, unknown>;
  assetId: string;
}

export function AssetMetadata({ metadata, assetId }: AssetMetadataProps) {
  return (
    <>
      {/* 元数据 */}
      <div className="space-y-2">
        <details className="cursor-pointer">
          <summary className="text-sm font-medium hover:text-foreground transition-colors">
            完整元数据
          </summary>
          <pre className="mt-2 p-3 bg-background rounded-md overflow-x-auto text-xs">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </details>
      </div>

      {/* 资产 ID */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground font-mono truncate">
          ID: {assetId}
        </p>
      </div>
    </>
  );
}

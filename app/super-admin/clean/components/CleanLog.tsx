import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileX, Database, CheckCircle2, AlertTriangle } from "lucide-react";

interface CleanResult {
  orphanedRows: {
    id: string;
    file_url: string;
    reason: string;
  }[];
  orphanedFiles: {
    path: string;
    name: string;
  }[];
  deletedRows: string[];
  deletedFiles: string[];
  errors: string[];
}

interface CleanLogProps {
  result: CleanResult;
}

export function CleanLog({ result }: CleanLogProps) {
  return (
    <div className="space-y-4">
      {/* 孤立的数据库记录 */}
      {result.orphanedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-orange-600" />
              孤立的数据库记录
            </CardTitle>
            <CardDescription>
              数据库中存在但文件已被删除的记录 ({result.orphanedRows.length} 条)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {result.orphanedRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono text-xs">
                        {row.id.slice(0, 8)}
                      </Badge>
                      {result.deletedRows.includes(row.id) ? (
                        <Badge className="bg-success text-success-foreground">已删除</Badge>
                      ) : (
                        <Badge variant="destructive">删除失败</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground break-all">
                      {row.file_url}
                    </p>
                    <p className="text-xs text-orange-700 mt-1">{row.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 孤立的存储文件 */}
      {result.orphanedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileX className="w-5 h-5 text-blue-600" />
              孤立的存储文件
            </CardTitle>
            <CardDescription>
              存储桶中存在但数据库无记录的文件 ({result.orphanedFiles.length}{" "}
              个)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {result.orphanedFiles.map((file) => (
                <div
                  key={file.path}
                  className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{file.name}</span>
                      {result.deletedFiles.includes(file.path) ? (
                        <Badge className="bg-success text-success-foreground">已删除</Badge>
                      ) : (
                        <Badge variant="destructive">删除失败</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {file.path}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 成功删除汇总 */}
      {(result.deletedRows.length > 0 || result.deletedFiles.length > 0) && (
        <Card className="border-success/30 bg-success/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-5 h-5" />
              清理完成
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {result.deletedRows.length > 0 && (
                <p className="text-success">
                  ✓ 已删除 {result.deletedRows.length} 条数据库记录
                </p>
              )}
              {result.deletedFiles.length > 0 && (
                <p className="text-success">
                  ✓ 已删除 {result.deletedFiles.length} 个存储文件
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 错误信息 */}
      {result.errors.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              错误记录 ({result.errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {result.errors.map((error, index) => (
                <div
                  key={index}
                  className="p-2 bg-background border border-destructive/30 rounded text-sm text-destructive"
                >
                  {error}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 无问题提示 */}
      {result.orphanedRows.length === 0 &&
        result.orphanedFiles.length === 0 &&
        result.errors.length === 0 && (
          <Card className="border-success/30 bg-success/10">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-12 h-12 text-success mb-4" />
              <p className="text-success font-medium">未发现需要清理的资源</p>
              <p className="text-sm text-success mt-2">
                数据库和存储桶状态良好
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}

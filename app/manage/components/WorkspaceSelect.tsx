import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Workspace } from "../types";

interface WorkspaceSelectProps {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  selectedWorkspace: Workspace | undefined;
  onWorkspaceChange: (workspaceId: string) => void;
  loading: boolean;
}

export function WorkspaceSelect({
  workspaces,
  selectedWorkspaceId,
  selectedWorkspace,
  onWorkspaceChange,
  loading,
}: WorkspaceSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="workspace">工作空间</Label>
      <Select
        value={selectedWorkspaceId || undefined}
        onValueChange={onWorkspaceChange}
        disabled={loading}
      >
        <SelectTrigger id="workspace">
          <SelectValue placeholder="选择工作空间..." />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.id} value={workspace.id}>
              {workspace.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedWorkspace && (
        <p className="text-xs text-muted-foreground">
          当前工作空间: {selectedWorkspace.name}
        </p>
      )}
    </div>
  );
}

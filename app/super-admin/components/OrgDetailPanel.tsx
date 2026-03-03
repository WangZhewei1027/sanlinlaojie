"use client";

import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Crown,
  Users,
  MapPin,
  FileType2,
  Trash2,
  X,
  Loader2,
  Save,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SetOwnerDialog } from "./SetOwnerDialog";
import {
  updateOrganization,
  deleteOrganization,
} from "../organizations/actions";
import type { OrgData } from "./OrgList";

const ALL_FILE_TYPES = [
  "image",
  "video",
  "audio",
  "document",
  "link",
  "text",
  "anchor",
] as const;

interface OrgDetailPanelProps {
  org: OrgData;
  onClose: () => void;
  onSuccess: () => void;
  onDeleted: () => void;
}

// ─── Section heading ────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

export function OrgDetailPanel({
  org,
  onClose,
  onSuccess,
  onDeleted,
}: OrgDetailPanelProps) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  // Basic info
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");

  // Map center
  const [lat, setLat] = useState(
    org.map_center?.lat != null ? String(org.map_center.lat) : "",
  );
  const [lng, setLng] = useState(
    org.map_center?.lng != null ? String(org.map_center.lng) : "",
  );

  // File types (null → all allowed, treat as all checked)
  const [fileTypes, setFileTypes] = useState<Set<string>>(
    new Set(org.allowed_file_types ?? ALL_FILE_TYPES),
  );

  const [saveError, setSaveError] = useState("");

  // Owner & delete dialogs
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const hasChanged =
    name !== org.name ||
    description !== (org.description ?? "") ||
    lat !== (org.map_center?.lat != null ? String(org.map_center.lat) : "") ||
    lng !== (org.map_center?.lng != null ? String(org.map_center.lng) : "") ||
    JSON.stringify([...fileTypes].sort()) !==
      JSON.stringify([...(org.allowed_file_types ?? ALL_FILE_TYPES)].sort());

  const handleSave = () => {
    if (!name.trim()) return;
    setSaveError("");

    const latNum = lat.trim() ? parseFloat(lat) : null;
    const lngNum = lng.trim() ? parseFloat(lng) : null;
    const mapCenter =
      latNum != null && lngNum != null && !isNaN(latNum) && !isNaN(lngNum)
        ? { lat: latNum, lng: lngNum }
        : null;

    const selectedTypes = [...fileTypes];
    const allSelected = selectedTypes.length === ALL_FILE_TYPES.length;

    startTransition(async () => {
      const result = await updateOrganization(org.id, {
        name: name.trim(),
        description: description.trim() || null,
        map_center: mapCenter,
        allowed_file_types: allSelected ? null : selectedTypes,
      });
      if (result.error) {
        setSaveError(result.error);
      } else {
        onSuccess();
      }
    });
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    setDeleteError("");
    const result = await deleteOrganization(org.id);
    setDeleteLoading(false);
    if (result.error) {
      setDeleteError(result.error);
    } else {
      setDeleteDialogOpen(false);
      onDeleted();
    }
  };

  const toggleFileType = (type: string) => {
    setFileTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const members = org.organization_member ?? [];
  const owners = members.filter((m) => m.role === "owner");
  const nonOwners = members.filter((m) => m.role !== "owner");

  return (
    <div className="flex flex-col h-full">
      {/* ── Panel header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">
            {t("superAdmin.orgs.details", "Organization Details")}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-0.5">
        {/* ── § Basic Info ── */}
        <section className="space-y-3">
          <SectionHeader
            icon={Building2}
            label={t("superAdmin.orgs.section.basicInfo", "Basic Info")}
          />
          <div className="space-y-2">
            <Label htmlFor="org-name" className="text-xs">
              {t("superAdmin.orgs.createDialog.name", "Name")}
            </Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                "superAdmin.orgs.createDialog.namePlaceholder",
                "Organization name",
              )}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-desc" className="text-xs">
              {t("superAdmin.orgs.createDialog.desc", "Description")}
            </Label>
            <Textarea
              id="org-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(
                "superAdmin.orgs.createDialog.descPlaceholder",
                "Optional description",
              )}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </section>

        <div className="border-t" />

        {/* ── § Map Center ── */}
        <section className="space-y-3">
          <SectionHeader
            icon={MapPin}
            label={t("superAdmin.orgs.section.mapCenter", "Map Center")}
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="org-lat"
                className="text-xs text-muted-foreground"
              >
                {t("superAdmin.orgs.mapCenter.lat", "Latitude")}
              </Label>
              <Input
                id="org-lat"
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="31.2304"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="org-lng"
                className="text-xs text-muted-foreground"
              >
                {t("superAdmin.orgs.mapCenter.lng", "Longitude")}
              </Label>
              <Input
                id="org-lng"
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="121.4737"
                className="h-8 text-sm"
              />
            </div>
          </div>
          {(lat || lng) && (
            <p className="text-xs text-muted-foreground">
              {lat && lng
                ? `${lat}, ${lng}`
                : t(
                    "superAdmin.orgs.mapCenter.incomplete",
                    "Both lat and lng are required",
                  )}
            </p>
          )}
        </section>

        <div className="border-t" />

        {/* ── § Allowed File Types ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader
              icon={FileType2}
              label={t(
                "superAdmin.orgs.section.fileTypes",
                "Allowed File Types",
              )}
            />
            <span className="text-xs text-muted-foreground">
              {fileTypes.size === ALL_FILE_TYPES.length
                ? t("superAdmin.orgs.fileTypes.all", "All")
                : `${fileTypes.size} / ${ALL_FILE_TYPES.length}`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-2">
            {ALL_FILE_TYPES.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <Checkbox
                  id={`ft-${type}`}
                  checked={fileTypes.has(type)}
                  onCheckedChange={() => toggleFileType(type)}
                />
                <Label
                  htmlFor={`ft-${type}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {t(`fileTypes.${type}`, type)}
                </Label>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t" />

        {/* ── Save button + error ── */}
        <div className="space-y-2">
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          <Button
            onClick={handleSave}
            disabled={!hasChanged || !name.trim() || isPending}
            size="sm"
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-2" />
            )}
            {t("superAdmin.orgs.saveChanges", "Save Changes")}
          </Button>
        </div>

        <div className="border-t" />

        {/* ── § Members ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader
              icon={Crown}
              label={t("superAdmin.orgs.currentOwners", "Owners")}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setOwnerDialogOpen(true)}
            >
              {t("superAdmin.orgs.setOwner", "Set Owner")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {owners.length > 0 ? (
              owners.map((owner) => (
                <Badge
                  key={owner.id}
                  variant="default"
                  className="flex items-center gap-1 text-xs py-0"
                >
                  <Crown className="h-2.5 w-2.5" />
                  {owner.users?.name ||
                    owner.users?.email?.split("@")[0] ||
                    owner.user_id.slice(0, 8)}
                </Badge>
              ))
            ) : (
              <Badge variant="destructive" className="text-xs py-0">
                {t("superAdmin.orgs.noOwner", "No owner")}
              </Badge>
            )}
          </div>

          {nonOwners.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Users className="h-3 w-3" />
                {t("superAdmin.orgs.members", "Members")} ({nonOwners.length})
              </div>
              {nonOwners.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-1 px-2 rounded text-xs hover:bg-muted/40"
                >
                  <span className="truncate text-sm">
                    {m.users?.name ||
                      m.users?.email?.split("@")[0] ||
                      m.user_id.slice(0, 12)}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] py-0 ml-2 flex-shrink-0"
                  >
                    {m.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── ID ── */}
        <p className="text-[10px] text-muted-foreground/50 font-mono break-all pt-1">
          ID: {org.id}
        </p>
      </div>

      {/* ── Danger zone ── */}
      <div className="pt-4 mt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/30"
          onClick={() => {
            setDeleteError("");
            setDeleteDialogOpen(true);
          }}
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          {t("superAdmin.orgs.deleteOrg", "Delete Organization")}
        </Button>
      </div>

      {/* Set Owner Dialog */}
      <SetOwnerDialog
        open={ownerDialogOpen}
        onOpenChange={setOwnerDialogOpen}
        org={org}
        onSuccess={onSuccess}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t("superAdmin.orgs.deleteDialog.title", "Delete Organization")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "superAdmin.orgs.deleteDialog.description",
                'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
                { name: org.name },
              )}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              {t("common.delete", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OrgList, type OrgData } from "../components/OrgList";
import { OrgDetailPanel } from "../components/OrgDetailPanel";
import { CreateOrgDialog } from "../components/CreateOrgDialog";

export default function OrganizationsPage() {
  const { t } = useTranslation();
  const [organizations, setOrganizations] = useState<OrgData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<OrgData | null>(null);

  const fetchOrgs = async (): Promise<OrgData[]> => {
    try {
      const res = await fetch("/api/admin/organizations");
      const data = await res.json();
      if (data.data) {
        setOrganizations(data.data);
        return data.data;
      }
    } catch (error) {
      console.error("Fetch orgs failed:", error);
    } finally {
      setLoading(false);
    }
    return [];
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleSelectOrg = (org: OrgData) => {
    setSelectedOrg((prev) => (prev?.id === org.id ? null : org));
  };

  const handleSuccess = () => {
    fetchOrgs().then((orgs) => {
      setSelectedOrg((prev) => {
        if (!prev) return null;
        return orgs.find((o) => o.id === prev.id) ?? null;
      });
    });
  };

  const handleDeleted = () => {
    setSelectedOrg(null);
    fetchOrgs();
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-7 w-7" />
              <h1 className="text-2xl font-bold">
                {t("superAdmin.orgs.title", "Organization Management")}
              </h1>
            </div>
            <p className="text-muted-foreground">
              {t(
                "superAdmin.orgs.description",
                "Manage all organizations and set owners",
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <CreateOrgDialog onSuccess={handleSuccess} />
            <div className="text-right">
              <p className="text-2xl font-bold">{organizations.length}</p>
              <p className="text-sm text-muted-foreground">
                {t("superAdmin.orgs.totalOrgs", "Total")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content: grid + detail panel */}
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          <OrgList
            organizations={organizations}
            selectedOrgId={selectedOrg?.id}
            onSelectOrg={handleSelectOrg}
          />
          {!selectedOrg && organizations.length > 0 && (
            <p className="text-sm text-muted-foreground text-center mt-8">
              {t(
                "superAdmin.orgs.selectOrgHint",
                "Click a card to view and edit the organization",
              )}
            </p>
          )}
        </div>

        {selectedOrg && (
          <div className="w-80 flex-shrink-0 sticky top-6">
            <Card className="p-5">
              <OrgDetailPanel
                key={selectedOrg.id}
                org={selectedOrg}
                onClose={() => setSelectedOrg(null)}
                onSuccess={handleSuccess}
                onDeleted={handleDeleted}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { OrgData } from "../types";

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<OrgData[]>([]);
  const [loading, setLoading] = useState(true);

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

  return { organizations, loading, fetchOrgs };
}

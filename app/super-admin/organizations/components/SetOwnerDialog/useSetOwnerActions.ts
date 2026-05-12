import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { OrgData, MemberData } from "../../types";

interface UseSetOwnerActionsOptions {
  org: OrgData;
  members: MemberData[];
  onSuccess: () => void;
  onClose: () => void;
}

export function useSetOwnerActions({
  org,
  members,
  onSuccess,
  onClose,
}: UseSetOwnerActionsOptions) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setOwner = async (selectedUserId: string) => {
    if (!selectedUserId) return;
    setError("");
    setLoading(true);

    try {
      const existingMember = members.find((m) => m.user_id === selectedUserId);

      if (existingMember) {
        const res = await fetch(`/api/organizations/${org.id}/members`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            member_id: existingMember.id,
            role: "owner",
          }),
        });
        const result = await res.json();
        if (!res.ok)
          throw new Error(
            result.error || t("common.updateFailed", "Update failed"),
          );
      } else {
        const res = await fetch(`/api/organizations/${org.id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: selectedUserId,
            role: "owner",
          }),
        });
        const result = await res.json();
        if (!res.ok)
          throw new Error(
            result.error || t("common.updateFailed", "Update failed"),
          );
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("common.updateFailed", "Update failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const removeOwner = async (memberId: string) => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/organizations/${org.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          role: "member",
        }),
      });
      const result = await res.json();
      if (!res.ok)
        throw new Error(
          result.error || t("common.updateFailed", "Update failed"),
        );

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("common.updateFailed", "Update failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, setError, setOwner, removeOwner };
}

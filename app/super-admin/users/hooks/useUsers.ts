import { useEffect, useState } from "react";
import type { UserData } from "../types";

export function useUsers() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (data.data) setUsers(data.data);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [roleRes, usersRes] = await Promise.all([
          fetch("/api/auth/role"),
          fetch("/api/users"),
        ]);
        const [roleData, usersData] = await Promise.all([
          roleRes.json(),
          usersRes.json(),
        ]);

        if (roleData?.userId) setCurrentUserId(roleData.userId);
        if (usersData?.data) setUsers(usersData.data);
      } catch (error) {
        console.error("Init failed:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  return { users, currentUserId, loading, refetch };
}

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import type { ErrorLogFilters, ErrorLogResponse } from "../types";

const PAGE_SIZE = 50;

export const EMPTY_FILTERS: ErrorLogFilters = {
  scope: "all",
  statusClass: "all",
  q: "",
  from: "",
  to: "",
};

function buildQuery(filters: ErrorLogFilters, offset: number): string {
  const params = new URLSearchParams();
  if (filters.scope !== "all") params.set("scope", filters.scope);
  if (filters.statusClass !== "all")
    params.set("statusClass", filters.statusClass);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  // Interpret the date inputs as an inclusive day range in local time.
  if (filters.from) params.set("from", new Date(filters.from).toISOString());
  if (filters.to) {
    const end = new Date(filters.to);
    end.setDate(end.getDate() + 1); // `to` is exclusive in the RPC
    params.set("to", end.toISOString());
  }
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));
  return params.toString();
}

export function useErrorLogs() {
  const [filters, setFilters] = useState<ErrorLogFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ErrorLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetchJson<ErrorLogResponse>(
        `/api/errors/logs?${buildQuery(filters, page * PAGE_SIZE)}`,
      );
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to the first page whenever the filters change.
  const applyFilters = useCallback((next: ErrorLogFilters) => {
    setPage(0);
    setFilters(next);
  }, []);

  return {
    filters,
    setFilters: applyFilters,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    data,
    loading,
    error,
    refetch: load,
  };
}

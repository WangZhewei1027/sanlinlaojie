import type { PostgrestError } from "@supabase/supabase-js";

// Supabase (PostgREST) 默认单次最多返回 1000 行。需要拉全量时用本工具分页循环。
export const SUPABASE_PAGE_SIZE = 1000;

interface RangeQuery<T> {
  range(
    from: number,
    to: number,
  ): PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
}

/**
 * 反复调用 buildQuery() 并配合 .range() 把所有行拉全，绕过 PostgREST 的 1000 行上限。
 * buildQuery 每次需返回一个全新的 query builder（不能复用已 await 过的）。
 */
export async function fetchAllRows<T>(
  buildQuery: () => RangeQuery<T>,
  pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const all: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) {
      return { data: all, error };
    }
    if (!data || data.length === 0) {
      break;
    }
    all.push(...data);
    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return { data: all, error: null };
}

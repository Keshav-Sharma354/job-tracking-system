'use server';

/**
 * Global search endpoint for the header combobox.
 *
 * Returns an empty payload for anonymous callers rather than throwing: the
 * search box renders in the header, and an unauthenticated visitor should simply
 * see no suggestions, not an error.
 */
import { getSession } from "@/lib/auth/session";
import { globalSearch, type SearchHit } from "@/server/repo/activity";
import { z } from "zod";

export type { SearchHit };

export type GlobalSearchPayload = {
  jobs: SearchHit[];
  contacts: SearchHit[];
  companies: SearchHit[];
  notes: SearchHit[];
  emails: SearchHit[];
  tasks: SearchHit[];
};

const EMPTY: GlobalSearchPayload = {
  jobs: [],
  contacts: [],
  companies: [],
  notes: [],
  emails: [],
  tasks: [],
};

export async function globalSearchAction(
  rawQuery: string,
): Promise<GlobalSearchPayload> {
  const parsed = z
    .string()
    .trim()
    .max(200)
    .safeParse(rawQuery);

  if (!parsed.success || parsed.data.length < 2) return EMPTY;

  const session = await getSession();
  if (!session) return EMPTY;

  return globalSearch(session.userId, parsed.data, 5);
}

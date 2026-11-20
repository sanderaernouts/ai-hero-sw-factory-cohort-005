import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "~/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

type Query = (db: Db, ...args: never) => unknown;

type Bound<F> = F extends (db: Db, ...args: infer A) => infer R
  ? (...args: A) => R
  : never;

/** Hands each query the given database, so callers pass only their own arguments. */
export function bindDb<T extends Record<string, Query>>(
  db: Db,
  queries: T
): { [K in keyof T]: Bound<T[K]> } {
  return Object.fromEntries(
    Object.entries(queries).map(([name, query]) => [
      name,
      (...args: never[]) =>
        (query as (db: Db, ...a: never[]) => unknown)(db, ...args),
    ])
  ) as { [K in keyof T]: Bound<T[K]> };
}

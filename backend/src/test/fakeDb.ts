import type { Prisma } from "../generated/prisma/client.ts";

/**
 * A minimal in-memory stand-in for a Prisma transaction client, for unit tests
 * of the domain helpers in src/lib that take a `tx` argument. Never touches a
 * real database.
 *
 * Supports only what those helpers use: equality / null matching, `in`, `not`,
 * `lt`/`lte`/`gt`/`gte`, `OR`/`AND`, `orderBy` (object or array), and a small
 * configurable `include` for one-to-many relations (unconfigured ones are
 * skipped). `select`/`omit` are ignored — the full row is returned, which is a
 * superset of what callers read. `$transaction` runs the callback against the
 * same client (no isolation or rollback), and `$executeRaw` calls are recorded
 * in `rawCalls` instead of executed.
 */
export type Row = Record<string, unknown> & { id: number };

type Where = Record<string, unknown>;
type OrderBy = Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[];

function comparable(value: unknown): unknown {
  return value instanceof Date ? value.getTime() : value;
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (condition !== null && typeof condition === "object" && !(condition instanceof Date)) {
    const c = condition as Record<string, unknown>;
    const v = comparable(value) as number;
    if ("in" in c && !(c.in as unknown[]).map(comparable).includes(v)) return false;
    if ("not" in c && comparable(c.not) === v) return false;
    if ("lt" in c && !(v < (comparable(c.lt) as number))) return false;
    if ("lte" in c && !(v <= (comparable(c.lte) as number))) return false;
    if ("gt" in c && !(v > (comparable(c.gt) as number))) return false;
    if ("gte" in c && !(v >= (comparable(c.gte) as number))) return false;
    return true;
  }
  return comparable(value ?? null) === comparable(condition);
}

export function matchesWhere(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (condition === undefined) return true;
    if (key === "OR") return (condition as Where[]).some((w) => matchesWhere(row, w));
    if (key === "AND") return (condition as Where[]).every((w) => matchesWhere(row, w));
    return matchesCondition(row[key], condition);
  });
}

function sortRows(rows: Row[], orderBy: OrderBy | undefined): Row[] {
  if (!orderBy) return [...rows].sort((a, b) => a.id - b.id);
  const keys = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) => Object.entries(o));
  return [...rows].sort((a, b) => {
    for (const [key, dir] of keys) {
      const av = comparable(a[key]) as number | null;
      const bv = comparable(b[key]) as number | null;
      if (av === bv) continue;
      // Postgres sorts NULLs last for ASC and first for DESC.
      if (av === null || av === undefined) return dir === "asc" ? 1 : -1;
      if (bv === null || bv === undefined) return dir === "asc" ? -1 : 1;
      return (av < bv ? -1 : 1) * (dir === "asc" ? 1 : -1);
    }
    return 0;
  });
}

interface Relation {
  table: string;
  foreignKey: string;
}

export interface FakeDbOptions {
  /** Column defaults applied on create, per table (e.g. `notification: { resolved: false }`). */
  defaults?: Record<string, Record<string, unknown>>;
  /** One-to-many relations resolvable through `include`, per table. */
  relations?: Record<string, Record<string, Relation>>;
}

const DEFAULTS: Record<string, Record<string, unknown>> = {
  notification: {
    catId: null,
    kennelId: null,
    checklistId: null,
    resolved: false,
    resolvedAt: null,
    resolvedById: null,
    dismissed: false,
  },
  signTask: { completedById: null, completedAt: null },
  kennelMoveRequest: { completedById: null, completedAt: null },
  checklistAction: { completed: false, completedById: null, completedAt: null },
  cat: { kennelId: null, groupId: null, active: true, pickupAt: null },
  group: { kennelId: null, bonded: false },
  kennel: { deletedAt: null },
};

const RELATIONS: Record<string, Record<string, Relation>> = {
  kennelPrepChecklist: { actions: { table: "checklistAction", foreignKey: "checklistId" } },
};

export function createFakeDb(options: FakeDbOptions = {}) {
  const tables: Record<string, Row[]> = {};
  let nextId = 1;
  const defaults = { ...DEFAULTS, ...options.defaults };
  const relations = { ...RELATIONS, ...options.relations };

  const table = (name: string): Row[] => (tables[name] ??= []);

  function withIncludes(name: string, row: Row, include?: Record<string, unknown>): Row {
    const copy: Row = { ...row };
    for (const [relName, spec] of Object.entries(include ?? {})) {
      const rel = relations[name]?.[relName];
      // Unconfigured relations are skipped: route tests only read scalar fields.
      if (!rel) continue;
      const orderBy =
        (spec as { orderBy?: OrderBy } | true) === true
          ? undefined
          : (spec as { orderBy?: OrderBy }).orderBy;
      copy[relName] = sortRows(
        table(rel.table).filter((r) => r[rel.foreignKey] === row.id),
        orderBy,
      ).map((r) => ({ ...r }));
    }
    return copy;
  }

  function insert(name: string, data: Record<string, unknown>): Row {
    const row: Row = { ...defaults[name], ...data, id: (data.id as number) ?? nextId++ };
    table(name).push(row);
    return row;
  }

  function delegate(name: string) {
    const find = (where?: Where) => table(name).filter((r) => matchesWhere(r, where));
    return {
      findUnique: async (args: { where: Where; include?: Record<string, unknown> }) => {
        const row = find(args.where)[0];
        return row ? withIncludes(name, row, args.include) : null;
      },
      findUniqueOrThrow: async (args: { where: Where; include?: Record<string, unknown> }) => {
        const row = find(args.where)[0];
        if (!row) throw new Error(`fakeDb: ${name} not found for ${JSON.stringify(args.where)}`);
        return withIncludes(name, row, args.include);
      },
      findFirst: async (args: { where?: Where; orderBy?: OrderBy } = {}) => {
        const row = sortRows(find(args.where), args.orderBy)[0];
        return row ? { ...row } : null;
      },
      findMany: async (args: { where?: Where; orderBy?: OrderBy } = {}) =>
        sortRows(find(args.where), args.orderBy).map((r) => ({ ...r })),
      count: async (args: { where?: Where } = {}) => find(args.where).length,
      create: async (args: { data: Record<string, unknown> }) => ({ ...insert(name, args.data) }),
      createMany: async (args: { data: Record<string, unknown>[] }) => {
        for (const data of args.data) insert(name, data);
        return { count: args.data.length };
      },
      update: async (args: { where: Where; data: Record<string, unknown> }) => {
        const row = find(args.where)[0];
        if (!row) throw new Error(`fakeDb: ${name} to update not found`);
        Object.assign(row, args.data);
        return { ...row };
      },
      updateMany: async (args: { where?: Where; data: Record<string, unknown> }) => {
        const hit = find(args.where);
        for (const row of hit) Object.assign(row, args.data);
        return { count: hit.length };
      },
      delete: async (args: { where: Where }) => {
        const rows = table(name);
        const index = rows.findIndex((r) => matchesWhere(r, args.where));
        if (index < 0) throw new Error(`fakeDb: ${name} to delete not found`);
        return rows.splice(index, 1)[0];
      },
      deleteMany: async (args: { where?: Where } = {}) => {
        const keep = table(name).filter((r) => !matchesWhere(r, args.where));
        const count = table(name).length - keep.length;
        tables[name] = keep;
        return { count };
      },
    };
  }

  const delegates = new Map<string, ReturnType<typeof delegate>>();
  const rawCalls: { sql: string; values: unknown[] }[] = [];
  const client: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        if (prop === "then") return undefined;
        if (prop === "$transaction") {
          return async (arg: unknown) =>
            typeof arg === "function" ? arg(client) : Promise.all(arg as Promise<unknown>[]);
        }
        if (prop === "$executeRaw") {
          return async (strings: TemplateStringsArray, ...values: unknown[]) => {
            rawCalls.push({ sql: strings.join("?"), values });
            return 1;
          };
        }
        if (!delegates.has(prop)) delegates.set(prop, delegate(prop));
        return delegates.get(prop);
      },
    },
  );

  return {
    /** Pass to the function under test. */
    tx: client as unknown as Prisma.TransactionClient,
    /** The same client, for code that imports a top-level `prisma`. */
    client,
    /** Every `$executeRaw` call, in order. */
    rawCalls,
    /** Seeds a row and returns it (the live row — later writes show up on it). */
    insert,
    /** Live rows of a table (camelCase delegate name, e.g. "signTask"). */
    rows: (name: string): Row[] => table(name),
    /** Rows of a table matching a where clause. */
    where: (name: string, where: Where): Row[] => table(name).filter((r) => matchesWhere(r, where)),
    /** Finds one row by id (throws if missing). */
    get: (name: string, id: number): Row => {
      const row = table(name).find((r) => r.id === id);
      if (!row) throw new Error(`fakeDb: ${name} ${id} not seeded`);
      return row;
    },
  };
}

export type FakeDb = ReturnType<typeof createFakeDb>;

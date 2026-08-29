/**
 * Sample Widget API — source of truth for detectors.
 *
 * Intentionally differs from docs/api.md (planted code–doc drift):
 * - createWidget now requires `ownerId` and returns `Widget` with `status`
 * - `deleteWidget` was renamed from documented `removeWidget`
 * - `listWidgets` pagination uses `cursor`, not `page`
 */

export type WidgetStatus = "draft" | "active" | "archived";

export interface Widget {
  id: string;
  name: string;
  ownerId: string;
  status: WidgetStatus;
  createdAt: string;
}

export interface CreateWidgetInput {
  name: string;
  /** Required as of v2 — docs still omit this. */
  ownerId: string;
}

export interface ListWidgetsOptions {
  /** Cursor-based pagination (docs still describe page/limit). */
  cursor?: string;
  limit?: number;
}

const store = new Map<string, Widget>();

export function createWidget(input: CreateWidgetInput): Widget {
  const widget: Widget = {
    id: crypto.randomUUID(),
    name: input.name,
    ownerId: input.ownerId,
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  store.set(widget.id, widget);
  return widget;
}

export function getWidget(id: string): Widget | undefined {
  return store.get(id);
}

export function listWidgets(options: ListWidgetsOptions = {}): Widget[] {
  const all = [...store.values()];
  const limit = options.limit ?? 20;
  if (!options.cursor) {
    return all.slice(0, limit);
  }
  const start = all.findIndex((w) => w.id === options.cursor) + 1;
  return all.slice(Math.max(0, start), Math.max(0, start) + limit);
}

/** Renamed from removeWidget — docs still say removeWidget. */
export function deleteWidget(id: string): boolean {
  return store.delete(id);
}

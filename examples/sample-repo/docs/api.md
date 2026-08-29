# Widget API reference

> Planted drift: this page documents the **old** v1 API. Source of truth is `src/widgets.ts`.

## createWidget

Creates a widget with a name only (no owner required).

```ts
createWidget({ name: string }): { id: string; name: string }
```

## removeWidget

Deletes a widget by id. (Code renamed this to `deleteWidget`.)

```ts
removeWidget(id: string): void
```

## listWidgets

Offset pagination with `page` and `limit`:

```ts
listWidgets({ page?: number; limit?: number }): Widget[]
```

## Validated examples

Runnable snippets tagged `validate` — the example detector parse-checks these.

Stale rename (should flag `removeWidget` → `deleteWidget`):

```ts validate
const ok = removeWidget("w_1");
console.log(ok);
```

Broken syntax (should flag parse failure):

```ts validate
function broken( {
  return 1;
}
```

## Related

- See [Getting started](./getting-started.md) for install steps.
- OpenAPI: operation `removeWidget` and `GET /widgets` page query — see [OpenAPI guide](./openapi.md).
- Broken relative link (file missing): [Deployment guide](./deployment.md)
- Broken anchor on this page: [Advanced filtering](#advanced-filtering)
- External-looking relative path that does not exist: [Changelog](../CHANGELOG.md)

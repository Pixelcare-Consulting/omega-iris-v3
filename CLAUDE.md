# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm**.

```bash
pnpm dev            # next dev
pnpm build          # next build
pnpm start          # next start (serves the production build)
pnpm lint           # eslint
pnpm format         # prettier --write .

pnpm db:push        # prisma db push + generate (schema-push workflow, no migrations dir)
pnpm db:pull        # prisma db pull
pnpm db:generate    # regenerate client into prisma/generated/
pnpm db:reset       # prisma db push --force-reset
pnpm db:seed        # db:reset then tsx prisma/seed.ts
pnpm db:studio      # prisma studio --browser none
```

**`pnpm db:seed` runs `db:reset` first, so it force-resets the database.** Never run it to pick up a new permission or reference entry against data worth keeping; add that row by hand instead. Same for `db:reset` itself.

There is no test setup in this repo. Verification is `pnpm lint` and `pnpm build`.

Environment variables are documented in [README.md](README.md); `NEXT_PUBLIC_DISABLE_REPORTING` hides the role-report actions and `SIGNIN_MAXIMUM_ATTEMPTS` (default 5) drives account lockout in [actions/auth.ts](actions/auth.ts).

After any edit to [prisma/schema.prisma](prisma/schema.prisma), run `pnpm db:push`. The generated client lives in `prisma/generated/` (gitignored, imported as `@/prisma/generated/client`), not `node_modules`, so a fresh clone must run `pnpm db:generate` before anything typechecks.

## Architecture

- Next.js 16 App Router + React 19
- Prisma 7 (PostgreSQL via `@prisma/adapter-pg`)
- better-auth
- next-safe-action
- CASL for RBAC
- TanStack Table
- Shadcn/ui + Tailwind v4
- Zod v4
- Pino.

### Request flow / auth

- [proxy.ts](proxy.ts) is the Next.js proxy (middleware equivalent). It classifies each path against `PUBLIC_ROUTES` / `AUTH_ROUTES` in [constants/routes.ts](constants/routes.ts) and redirects. **It fails closed.** Anything that isn't public, an auth route, or under `AUTH_API_PREFIX` requires a session, so a new protected route needs no route-list entry. Page-level _authorization_ is still each page's own job (see below).
- Auth is better-auth ([lib/auth.ts](lib/auth.ts), client in [lib/auth-client.ts](lib/auth-client.ts), route handler under `app/api/auth`). The session user is enriched with `roleKey`, `roleCode`, `rolePermissions`.
- App routes are split into route groups: `app/(auth)` (signin) and `app/(protected)` (sidebar/panel layout in `app/(protected)/_components`).

### Server actions, the two-layer pattern

Every feature in [actions/](actions/) exposes two layers, and this split is deliberate:

1. **Plain async functions** (`getUsers`, `getUserByCode`, `upsertUser` internals), called directly from Server Components. They swallow errors via `logger.error(err, '[GET_USERS_ERROR]:')` and return a safe fallback.
2. **`...Client` next-safe-action wrappers**, `export const getUserByCodeClient = action.use(authenticationMiddleware).inputSchema(<zod>).action(...)`, consumed from Client Components via `useAction`.

`authenticationMiddleware` in [lib/safe-action.ts](lib/safe-action.ts) re-loads the user with role + permissions and injects `ctx` (`userId`, `userCode`, `roleKey`, `ability`, …). **Never import anything into `lib/safe-action.ts` that itself imports from `actions/`.** It causes a circular-dependency `Cannot access 'action' before initialization` error (documented in-file).

Client hooks that drive these wrappers live in [hooks/safe-actions/](hooks/safe-actions/), one file per feature, mirroring `actions/`.

**Mutation return envelope.** Mutations don't throw for expected failures. They return a plain object the caller inspects:

```ts
{ status: number, error: boolean, message: string, action: 'UPSERT_USER', data?, paths? }
```

`paths` (`{ field, message }[]`) carries per-field server-side validation failures (duplicate username/email) so the form can `form.setError(field, …)`. Keep `action` as an `UPPER_SNAKE` tag matching the function name, it is the grep handle in logs. Success uses the same shape with `error: false`.

### Forms

There are two form shapes. Both share one schema and one `upsert<Entity>` action for add and edit, and both derive an **`isCreate`** flag that drives default values, redirect target, and which fields are disabled.

**Page forms** ([app/(protected)/users/\_components/user-form.tsx](<app/(protected)/users/_components/user-form.tsx>) is the reference; also `role`, `ref-common`, `ref-council`, `ref-committee`). Add and edit share one route, `/<entities>/[code]` with the literal segment `add`:

- `const isCreate = code === 'add' || !<record>`, with `code` read from `useParams()`.
- A `values` memo maps the record to form values, or returns `DEFAULT_VALUES` when `isCreate`.

**Modal forms** ([app/(protected)/references/councils/[code]/view/\_components/ref-council-member-form.tsx](<app/(protected)/references/councils/[code]/view/_components/ref-council-member-form.tsx>)) are child records edited from a tab on the parent's view page, with no route of their own:

- `const isCreate = !<record>`, there is no `code` param.
- Props are `isOpen`, the parent record, the record or `null`, plus `onClose` / `onSuccess` / `onSaveAndNew`; defaults are seeded from the parent (a member's dates default to the council's).

Shared by both:

- `useForm({ mode: 'onChange', values, resolver: zodResolver(<entity>FormSchema) })` wrapped in `FormProvider`; fields are the context-reading components in [components/forms/](components/forms/) (`InputField`, `ComboboxField`, `SwitchField`, …). Don't hand-roll `<Controller>`.
- Submit handler: `await <action>.executeAsync(values)` → map `result.paths` to `form.setError` → `toast.error/success` (sonner) → `router.refresh()` then navigate. Wrap in try/catch that logs with `logger.error(err, '[<CONTEXT>_ERROR]:')` and shows a generic toast.
- Loading state comes from `useAction(...).isExecuting` fed into `LoadingButton`.
- A save / save-and-new pair goes through `useSubmitIntent` ([hooks/use-submit-intent.ts](hooks/use-submit-intent.ts)). Both buttons post the same form, and the handler reads `consumeIntent()` to decide whether to reset or navigate.

The upsert action derives the same flag server-side, from whatever identifier it received: `const isCreate = !originalCode` (or `!id`). It gates the uniqueness check's `NOT` clause and the "record still exists" lookup.

### Page-level authorization

Server Components fetch data and authorize before rendering: `Promise.all([get<Entity>ByCode(...), getCurrentUserWithAbility()])`, then `notFound()` for missing records and `authorizePage(ability, action, subject)` ([lib/authorization.ts](lib/authorization.ts)), which redirects to `UNAUTHORIZED_ROUTE` when the check fails. Call the helper rather than hand-rolling the `ability.can(...)` + `redirect` pair; it takes an already-resolved ability so the page keeps fetching it in parallel with its record. Client-side `<CanView>` only hides UI, so always keep the server check too.

### RBAC

Permission codes and allowed actions are declared in [constants/permission.ts](constants/permission.ts) (`PERMISSIONS_CODES`, `PERMISSIONS_ALLOWED_ACTIONS`, `DEFAULT_PERMISSIONS`, seeded by `pnpm db:seed`). Roles map to permissions via the `RolePermission` join model with an `actions` string array.

[lib/rbac.ts](lib/rbac.ts) turns `{ roleKey, rolePermissions }` into a CASL `Ability` where **subject = permission code** and **action = the action string**. The role whose key is `SUPER_USER_ROLE_KEY` ([constants/role.ts](constants/role.ts)) gets `can('manage', 'all')`.

- Server side: `ctx.ability` from the middleware, or `getCurrentUserWithAbility()` in [actions/user.ts](actions/user.ts).
- Client side: `AbilityContext` ([contexts/ability.ts](contexts/ability.ts)) provided by `components/providers/rbac-guard-provider.tsx`; gate UI with `<Can I='edit' a='p-users'>` ([components/rbac/can.tsx](components/rbac/can.tsx)) or `CanView`.

Adding a module means: add a `PERMISSIONS_CODES` entry + `DEFAULT_PERMISSIONS` record, reseed, then guard the UI and the page. **Reseeding wipes the database, so it is a development-only step.** In production insert the `Permission` and `RolePermission` rows by hand.

### Data tables

Two modes, pick per page:

- **Client-side**: `useDataTableClient` ([hooks/use-data-table-client.ts](hooks/use-data-table-client.ts)) over a fully-loaded array.
- **Server-side**: `useDataTableServer` + a `getDataTable<Entity>Svr(params)` action. `params` is validated by `dataTableParamsSchema` ([schema/data-table.ts](schema/data-table.ts)); [lib/data-table.ts](lib/data-table.ts) provides `buildColumnFiltersWhere` / `buildGlobalFilterWhere` that translate filter state into Prisma `where` input. The same action serves exports (`isExport` flag) via [lib/xlsx.ts](lib/xlsx.ts).

Shared table UI is in [components/data-table/](components/data-table/); column meta typing is extended in [types/react-table.d.ts](types/react-table.d.ts).

### Soft deletes

Most models carry `deletedAt/deletedBy` plus `createdBy/updatedBy` (`Int` user codes, not ids). Queries are expected to filter `deletedAt: null`; delete actions set the fields, and `restore` actions clear them.

## Conventions

Prettier: no semicolons, single quotes (incl. JSX), 140 print width, no trailing comma. Run `pnpm format` rather than hand-formatting.

Naming (from [README.md](README.md)):

- Files kebab-case; suffixes `-form`, `-field`, `-provider`.
- Route-local components go in a `_components/` folder next to the route; routes plural where possible.
- Server actions `<Verb><Noun>`; their safe-action wrappers add a `Client` suffix. Server-only data-table variants use an `Svr` suffix.
- Components `<Entity>Form`, `<Entity>Field`, `<Entity>Provider`; hooks `use<Entity>`; contexts `<Entity>Context`.
- Zod: `<entity>FormSchema` → type `<Entity>Form`; non-form `<entity>Schema` → `<Entity>`.
- Handler props `on<Event>`, implementations `handle<Event>`. Constants `UPPER_SNAKE_CASE`. Booleans prefixed `is`/`has`/`should`/`can`.
- Prisma models `PascalCase` singular (`User`, `RoleReport`).
- Named Prisma relations, only where Prisma can't infer one (two relations between the same pair, or a self-relation), use `"<Verb><Plural target>"`, e.g. `"PreparedLogs"`, `"ApprovedItems"`, `"AssignedTasks"`; it reads clearly from both sides.

Comment markers used throughout: `//*` explanatory note, `//?` known issue/question, `//!` warning, `//TODO:` todo. These are the `Better Comments` default markers.

**Comments are short labels in plain, everyday words.** Three to six words for most (`//* initialize where input`, `//* check if existing`), one line always, lowercase, no trailing period. Add a reason only when the code can't show it, and keep it to the same line (`//! navigate before refresh, refreshing here 404s when the code was renamed`). Skip the comment entirely when the name already says it. This applies to every comment you write or edit, not just ones the user asks about. The [concise-comments skill](.claude/skills/concise-comments/SKILL.md) has the word-swap table and before/after examples.

Theming is driven by a shadcn preset (`b6F9Pinaq`); see the README section on applying/altering the theme rather than editing tokens ad hoc.

Add shadcn primitives with `pnpm dlx shadcn@latest add <component>` instead of writing them by hand; treat [components/ui/](components/ui/) as generated-ish and put project-specific wrappers one level up in `components/`.

Icons are re-exported through [components/icons.ts](components/icons.ts). Import `Icons.save`, not `lucide-react` directly.

## Recipe: adding a CRUD module

Mirror the `users` module end to end; touching fewer than these files usually means something is unguarded.

1. **Model.** Add to [prisma/schema.prisma](prisma/schema.prisma) with the standard audit columns (`code @unique @default(autoincrement())`, `createdAt/updatedAt/deletedAt`, `createdBy/updatedBy/deletedBy`), then `pnpm db:push`.
2. **Permission.** Add a `PERMISSIONS_CODES` entry and a `DEFAULT_PERMISSIONS` record in [constants/permission.ts](constants/permission.ts); reseed with `pnpm db:seed`.
3. **Schema.** `schema/<entity>.ts` exporting `<entity>FormSchema` + inferred `<Entity>Form`.
4. **Actions.** `actions/<entity>.ts`: a `COMMON_<ENTITY>_INCLUDE` constant + exported `Prisma.<Entity>GetPayload` type, plain read functions, `getDataTable<Entity>Svr`, `upsert<Entity>`, `delete/restore`, plus the `...Client` wrappers.
5. **Hooks.** `hooks/safe-actions/<entity>.ts`.
6. **UI.** `app/(protected)/<entities>/page.tsx` (list), `[code]/page.tsx` (add/edit), `[code]/view/page.tsx` (view), with local pieces under `_components/`.
7. **Nav.** Add a `MenuItem` to `MENU_GROUPS` in [constants/config.ts](constants/config.ts) with `subjects`/`actions` set to the new permission; the sidebar renders and filters from that data, so no component edit is needed.

No route-guard step is needed: [proxy.ts](proxy.ts) fails closed, so any path that is not in `PUBLIC_ROUTES` / `AUTH_ROUTES` already requires a session.

## Gotchas

- `code` (`Int`) is the user-facing/URL/foreign-key identifier throughout; `id` (cuid) is mostly internal. Audit columns store `code`, not `id`, so read `ctx.userCode` for these, not `ctx.userId`.
- The Prisma client is a global singleton in [lib/db.ts](lib/db.ts). Always `import db from '@/lib/db'`, never `new PrismaClient()`.
- Types come from `@/prisma/generated/client`, not `@prisma/client`.
- Multi-write mutations use `db.$transaction(async (tx) => …)` (e.g. user + credential account password), so keep new mutations consistent.
- Passwords go through better-auth's `hashPassword` from `better-auth/crypto`, stored on the `Account` row with `providerId: 'credential'`, never on `User`.
- Data freshness relies on `router.refresh()` after mutations; there is no `revalidatePath`/`revalidateTag` in use, so don't mix in a second cache strategy without a reason.
- `logger` is pino and is imported in both server and client files here; keep messages tagged `'[CONTEXT_ERROR]:'`.
- `app/examples/` is knowingly stale. Skip it in refactors and lint sweeps, it is maintained separately.

## Shared helpers worth knowing before writing your own

- `withCurrentOption` ([lib/form.ts](lib/form.ts)) keeps a record's own deleted/inactive related row selectable in a picker, labelled `(Deleted)`/`(Inactive)`. Any select fed by a "live rows only" query needs it, or editing an old record silently blanks the field.
- `buildPermissionTree` ([lib/permissions.ts](lib/permissions.ts)) turns a flat `Permission[]` into a nested tree.
- `findMenuItemByUrl` ([lib/config.ts](lib/config.ts)) resolves the current path to its `MenuItem`, prefix-matching without letting `/users` claim `/usersettings`.
- `handleTabChange` ([lib/event-handler.ts](lib/event-handler.ts)) holds tab state in the `?tab=` search param.
- `useConfirmAction` ([hooks/use-confirm-action.ts](hooks/use-confirm-action.ts)) is the confirm-modal-then-mutate flow used by delete/restore buttons.
- `findSameText` ([lib/duplicate.ts](lib/duplicate.ts)) is the exact match for a duplicate check. Prisma's `equals` with `mode: 'insensitive'` runs as `ILIKE`, where `%` and `_` are wildcards, so `A_B` would clash with `AXB`. Query with `findMany`, then pick the real match with this. Every name check and the item master P/N check use it.
- `toFieldListMessage` ([lib/duplicate.ts](lib/duplicate.ts)) builds the toast for several failed fields with the right grammar: "Code and Name already exist!", "MFG P/N already exists!".
- `escapeLikeKeyword` ([lib/data-table.ts](lib/data-table.ts)) escapes `%`, `_` and `\` so a search matches them as typed. `buildGlobalFilterWhere` already calls it; any new `contains` filter on user input needs it too.

## File attachments

- **Where the files are.** On a flydrive disk at `STORAGE_PATH` (default `../omega-iris-v3-storage`), outside the project so uploads stay out of the dev watcher and the build. [lib/storage.ts](lib/storage.ts) owns it: `getDisk`, `getActiveDiskName`, `generateAttachmentKey`.
- **Where the metadata is.** The `FileAttachment` model, keyed by `moduleName` + `referenceId`. Generic on purpose: another module reuses the same table and routes, and only picks its own permission and limits. Limits live in [constants/file-attachment.ts](constants/file-attachment.ts).
- **Uploading.** `POST /api/file-attachments`, one file per request, called over XHR. It is a route handler and not a server action because only XHR can report upload progress.
- **Reading.** `GET /api/file-attachments/[id]`, session required. Previews inline; `?download=1` saves.
- **Everything else.** Reads, deletes and links use the normal safe-action pattern.
- **Item master thumbnails** are the first user. The item saves first, then the image uploads with `referenceId = item.id`, then `setItemMasterThumbnail` points the item at it and deletes the old file. Export embeds them through `POST /api/item-masters/export` (exceljs + sharp), since `xlsx-js-style` cannot hold images.
- **Deletes are permanent** for both attachments and links, so neither model has `deletedAt`. `deleteItem` only soft deletes, so an item's attachments survive for restore.
- **Changing storage.** `pnpm files:migrate --from=<disk> --to=<disk>`, any two disks, either direction. See [docs/file-attachment-migration.md](docs/file-attachment-migration.md).

## SAP sync

The item master is the reference module. Its sync actions live in [actions/item-master-sync.ts](actions/item-master-sync.ts). Copy that shape when another model syncs with SAP.

- **Calling SAP.** Go through `sapFetch(dbCode, '<endpoint key>', opts)` in [lib/sap/service-layer.ts](lib/sap/service-layer.ts), with keys typed in [lib/sap/endpoints.ts](lib/sap/endpoints.ts). It queues calls per database, retries once on a dead session, and returns `{ ok, status, message, data }` rather than throwing. The server runs Service Layer `/b1s/v2`, where `error.message` is a plain string. `toSapErrorMessage` reads both that and the v1 `{ value }` shape.
- **Field names.** PascalCase fields map to SAP (`ItemCode`, `FirmCode`, `ItmsGrpNam`). camelCase fields are portal only (`notes`, `thumbnail`, `isActive`). A pull never writes a camelCase field.
- **Row status.** Every synced model uses the one `SapSyncStatus` enum (`PENDING`, `SYNCED`, `FAILED`) plus `syncedAt` and `syncError`. A `SYNCED` row locks its SAP fields. Users change them in SAP and the next pull brings them back. Items that leave SAP stay `SYNCED`, on purpose.
- **Last sync point.** One `SapSyncState` row per `dbCode` + key, with the keys in `SAP_SYNC_KEYS` ([constants/sap-sync.ts](constants/sap-sync.ts)). Add a key there for each new direction. `startSapSyncRun` marks it `RUNNING`. `completeSapSyncRun` sets `lastSyncAt` to the run's start time, and only for the `RUNNING` run with the same start. There is no lock. A closed tab leaves `RUNNING`, and the next run takes over.
- **Pull.** Only changed rows, using the standard API. The filter is `U_Portal_Sync eq 'Y'` plus `toChangedSinceFilter(since)` from [lib/sap/sync.ts](lib/sap/sync.ts), where `since` is `lastSyncAt` minus `SYNC_LOOKBACK_DAYS` (default 2). The client walks pages of `SAP_SYNC_FROM_PAGE_SIZE` (1000) through `useBatchRun`. It loads the SAP lookups once and sends them with every page as `metaData`. One failed page fails the run, so the next run repeats the same window.
- **Push.** The client sends `SAP_SYNC_TO_CHUNK_SIZE` (20) ids per call. The server reloads each row, checks required fields, creates it in SAP, and returns a `BatchStepResult`. Status writes use `updateMany` with a condition (`syncStatus not SYNCED`, same `ItemCode`), so a race never flips a synced row back or links a renamed one.
- **UI pieces.** `SapSyncModal`, `BatchProgress`, `BatchResult`, `BatchErrorTable`, `useBatchRun` and `useLastBatchResult` are generic on purpose. Imports will reuse them.
- **Sync permissions.** `sync to sap` and `sync from sap` are actions on the module's permission. Any role can hold them, but in practice only Omega admins do.

## Superpowers plugin in this repo

The plugin is enabled at user scope and its bootstrap claims skills are mandatory. These instructions take precedence; this section is the deliberate scoping.

- **Use** `brainstorming` and `writing-plans` before any new module or non-trivial feature (the CRUD recipe spans 7 files), `systematic-debugging` before proposing any bug fix, and `receiving-code-review` / `dispatching-parallel-agents` as they come up.
- **Skip** `test-driven-development` (no test runner exists, and the skill deletes implementation written before its test, which here deletes work for nothing; don't add a suite just to satisfy the plugin), `using-git-worktrees` (parallel worktrees contend over the single shared Postgres and the generated Prisma client), and `finishing-a-development-branch` (gates on a passing suite, use normal git flow).
- **Adapt** `verification-before-completion` to mean evidence before claiming success, where the evidence is `pnpm lint`, `pnpm build`, and driving the affected page. Report failures with their output.

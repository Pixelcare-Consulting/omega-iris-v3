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

**`pnpm db:seed` runs `db:reset` first, so it force-resets the database.** Never run it to pick up a new permission or reference entry against data worth keeping. Same for `db:reset` itself. For permissions, run `pnpm db:update-permission` ([scripts/update-permissions.ts](scripts/update-permissions.ts)): it adds new `DEFAULT_PERMISSIONS` rows and actions, never deletes, and never touches role grants. Other reference rows still go in by hand.

Seeds that reset the database live in `prisma/`. Scripts that are safe to run on live data (`update-permissions`, `migrate-file-attachments`) live in `scripts/`.

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

Adding a module means: add a `PERMISSIONS_CODES` entry + `DEFAULT_PERMISSIONS` record, run `pnpm db:update-permission`, then guard the UI and the page. The script adds the `Permission` row or its new actions on any database. Granting them to roles (`RolePermission`) is still done in the Roles screen or by hand.

### Data tables

Two modes, pick per page:

- **Client-side**: `useDataTableClient` ([hooks/use-data-table-client.ts](hooks/use-data-table-client.ts)) over a fully-loaded array.
- **Server-side**: `useDataTableServer` + a `getDataTable<Entity>Svr(params)` action. `params` is validated by `dataTableParamsSchema` ([schema/data-table.ts](schema/data-table.ts)); [lib/data-table.ts](lib/data-table.ts) provides `buildColumnFiltersWhere` / `buildGlobalFilterWhere` that translate filter state into Prisma `where` input. The same action serves exports (`isExport` flag) via [lib/xlsx.ts](lib/xlsx.ts).

Shared table UI is in [components/data-table/](components/data-table/); column meta typing is extended in [types/react-table.d.ts](types/react-table.d.ts).

### Relation links

A column or read-only field that shows a related record links to that record's view page through `RelationLink` ([components/relation-link.tsx](components/relation-link.tsx)). Use it instead of a plain `Link` or `DataTableLinkCell`, so every link looks the same and a click never fires the row's own handler.

- **List cells show the code only**, to keep columns narrow. Wrap the existing `DataTableTextCell` in the link so search highlighting still works. A user shows their name and links by `code`. The customer projects list shows the category name, the one place a name beats the code.
- **View pages show `code (name)`** through `toCodeName` in [lib/utils.ts](lib/utils.ts), since a field has room for it. It also tags a deleted or inactive record. Reference data with a code and name uses it too, such as commodity, packaging type and the lookups the settings module will add, even when the field has no view page to link to.
- **Exports write `code (name)`** in `exportValue`, whatever the cell shows.
- **Empty values stay unlinked.** Return the plain dash (`<DataTableTextCell value={null} />` in a cell, `null` in a field).
- **The href** is `/<entities>/${encodeURIComponent(code)}/view`. Item masters link by `ItemCode`, which `InboundItem.mpn` already holds.
- **The link checks no permission.** The target page's `authorizePage` sends a user without access to the unauthorized page.

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
2. **Permission.** Add a `PERMISSIONS_CODES` entry and a `DEFAULT_PERMISSIONS` record in [constants/permission.ts](constants/permission.ts); run `pnpm db:update-permission`.
3. **Schema.** `schema/<entity>.ts` exporting `<entity>FormSchema` + inferred `<Entity>Form`.
4. **Actions.** `actions/<entity>.ts`: a `COMMON_<ENTITY>_INCLUDE` constant + exported `Prisma.<Entity>GetPayload` type, plain read functions, `getDataTable<Entity>Svr`, `upsert<Entity>`, `delete/restore`, plus the `...Client` wrappers. Each mutation calls `logActivity` in its transaction, with a config in `lib/activity-configs/<entity>.ts` and an `ACTIVITY_MODULES` entry.
5. **Hooks.** `hooks/safe-actions/<entity>.ts`.
6. **UI.** `app/(protected)/<entities>/page.tsx` (list), `[code]/page.tsx` (add/edit), `[code]/view/page.tsx` (view, with an Activity tab), with local pieces under `_components/`.
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
- `get<Entity>Options` (`getSiteOptions`, `getCustomerProjectOptions`, …) feed **list filters only**. They return `FilterOption[]` with inactive rows included, so old records stay filterable. Form pickers use the live-rows hook plus `withCurrentOption` instead.
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

## PDFs

- **How they render.** `@react-pdf/renderer` on the server, from a route handler that calls `renderToBuffer`. Copy [app/api/locations/[code]/label/pdf/route.ts](app/api/locations/[code]/label/pdf/route.ts). It returns 401 without a session or `dbCode`, 403 without the permission, and serves inline by default or as an `attachment` with `?download=1`. The href helper lives in the module's `lib/` file, like `getLocationLabelPdfHref` in [lib/location.ts](lib/location.ts).
- **Many records in one PDF.** POST the ids in the body, not the URL, like `POST /api/locations/labels/pdf`. The client sends it with axios as a blob through `useLabelsPdf(endpoint)` ([hooks/use-labels-pdf.ts](hooks/use-labels-pdf.ts)), which opens the tab before the request so the popup blocker lets it through.
- **Documents** go in [components/pdf/](components/pdf/). Read the records through a plain read function in `actions/`, never an exported include, since a `'use server'` file can only export async functions.
- **QR codes.** `qrcode.react` is for the screen only, it outputs DOM `<svg>` that react-pdf cannot draw. In a PDF, use `getQrPath` from [lib/qr.ts](lib/qr.ts) inside a react-pdf `<Svg>`.
- **QR labels.** Locations, pallets and containers share them. One label per page holding the QR and the code, drawn by `CodeLabelDocument` ([components/pdf/code-label-document.tsx](components/pdf/code-label-document.tsx)) for any `{ id, code }[]`. Sizes live in `LABEL_SIZES` ([constants/label.ts](constants/label.ts)). Mark one entry `isDefault`, now `4x2in`, and read `DEFAULT_LABEL_SIZE` rather than the flag. Requests are checked by `labelsPdfSchema` ([schema/label.ts](schema/label.ts)), and `LabelSizeModal` ([components/label-size-modal.tsx](components/label-size-modal.tsx)) picks the size. A new module adds two routes (`[code]/label/pdf` and `labels/pdf`), a `get<Entity>LabelPdfHref`, and a `get<Entity>sByIds` read. Print at Actual size, since "Fit to page" shrinks the label off the roll. The list's header checkbox ticks every row matching the current filters on all pages, through the export call (`isExport: true`), up to `LABEL_MAX_COUNT` (1000). The size picker passes `isModal={false}`, since a modal dialog blocks clicks on the portalled combobox list. The default size moves to settings once the settings module lands, modelled on lis.

## Pallets and containers

- **Codes.** `<category>-<project>-<yymonth>-P<0001>` for pallets and `-C<0001>` for containers, with general purpose dropping the first two parts. Numbers come from `reserveSequence` in [lib/sequence.ts](lib/sequence.ts), inside the save transaction, under the `PALLET` and `CONTAINER` keys. The scope is the prefix, so each project and month counts on its own.
- **Status.** Both use `StorageUnitStatus`, with labels in [constants/storage-unit.ts](constants/storage-unit.ts). Edit writes only `status`; everything else is locked after save.
- **Container location.** The location decides. A container can go on any active location, and the pallet is optional. A pallet is only allowed when the location allows pallets and the pallet already sits there. `validateContainerRefs` in [actions/container.ts](actions/container.ts) holds every container rule: an active location, an active pallet at that location, a pallet of the same project for project containers, and a general purpose pallet for general purpose containers. A container and its pallet always agree on the project.
- **Blocks.** A pallet with live containers can't leave Active. A location with live pallets can't turn off Pallet Allowed. A pallet can't be restored onto a location that is inactive or no longer allows pallets. A container can't be restored onto an inactive location, or a pallet that is no longer Active or has moved. A customer project's category is locked after create, since pallet and container codes hold it. Each block returns 409.
- **Moves.** A later movement feature changes locations. Moving a pallet there also moves its containers.

## Sessions

A `Session` is one stretch of floor work by one user at one site, for one `SessionType`. [actions/session.ts](actions/session.ts) and [actions/inbound.ts](actions/inbound.ts) hold the actions, and the screens live under `/sessions` and `/inbound`. Inbound is the only process built so far.

- **Lines.** `Session` is the header only. Each process gets its own table that points at the session by `dbCode` + `sessionCode`, the way `SessionPause` does. Inbound has `Inbound` with its `InboundItem` rows, and movement and cycle count will add their own. One generic line table would not fit, since inbound, movement and cycle count lines share almost no fields.
- **Codes.** `S-<yyyy>-<000001>`, e.g. `S-2026-000125`, one prefix for every type. `SESSION_SEQUENCE` in [lib/session-sequence.ts](lib/session-sequence.ts) makes them inside the start transaction under the `SESSION` key. The scope is `<dbCode>:<yyyy>`, so each database counts on its own and every year starts over. The code leaves `dbCode` out, since `Session` is unique on `dbCode` + `code`.
- **Start.** A user has at most one session that is `IN_PROGRESS` or `PAUSED`, and starting a second returns 409. Prisma cannot express that partial unique index, so the action checks it. The site must have the matching `isEnable*` switch on. The action copies `employeeId` from the user, so old sessions keep the right person after the user's id changes.
- **Pauses.** Each pause is a `SessionPause` row. Active time is `endedAt - startedAt` minus the closed pauses.
- **Cancel, never delete.** A cancelled session keeps its rows and gets a `cancelReason`. Its draft and submitted inbounds turn `CANCELLED`, and their unique IDs get `deletedAt`, logged as one `DELETE` per unit plus a `BULK_DELETE` row. This is the only way a unit is deleted.
- **Unique IDs.** `submitInbound` creates them inside its transaction, one per package, so labels print right after submit. Completing a session only closes it.
- **PO match.** A PO required inbound checks each MPN's package total against that MPN's open qty, summed over its PO lines. Save and import block a total above it, and submit with partial receiving off also blocks a total below it.
- **Mobile.** A mobile app will read and write sessions later. It cannot call server actions, so it goes through route handlers under `/api/mobile/` with better-auth bearer tokens.
- **Naming.** `User.sessions` is `Session[]`, and better-auth's own relation is `authSessions`. If `@better-auth/cli generate` writes `sessions AuthSession[]` back onto `User`, reject that part.
- **Users.** `isInternal` marks Omega personnel. `employeeId` is optional, saved uppercase, and unique. Both are `input: false` in [lib/auth.ts](lib/auth.ts), so only `upsertUser` writes them.

## Activity log

Every change a user makes writes one `ActivityLog` row. Each view page reads them back on its Activity tab, and `/audit-logs` lists them all. [lib/activity-log.ts](lib/activity-log.ts) holds the helpers, and [constants/activity-log.ts](constants/activity-log.ts) holds the module and action names.

- **Writing.** Call `logActivity(tx, …)` inside the mutation's `db.$transaction`, so a failed save logs nothing. Pass `ctx.actor` and `diffActivity(config, before, after)`. An `UPDATE` with no changed fields writes nothing, and one that only flips `isActive` or `status` saves as `STATUS`. A write with no stored before values, such as SAP or another third party, keeps its row only when it passes a `summary`.
- **Configs.** One per module in [lib/activity-configs/](lib/activity-configs/), listing the fields to log with their form labels. Only listed fields are logged, so a password or token never gets in by accident. A lookup uses `format` to show its name, and a child array (BP addresses, role permissions) goes under `children` with a `matchKey`. Configs can't sit in `actions/`, since a `'use server'` file only exports async functions.
- **Ids and names.** `entityId` is the record `id`, never its `code`, so a rename keeps the history together. The code, name and user name are saved as they were at the time.
- **Modules.** `ACTIVITY_MODULES` keys are modules, not Prisma models, so customers and vendors log apart. A child module has no permission of its own and reads through its parent.
- **Colors.** Each action has one of four tones by meaning: green for added or brought back, blue for changed, red for removed or failed, gray for no data changed. A new action picks one of these. Never add a fifth.
- **Bulk writes.** Bulk generate and imports call `logActivities`, one `createMany` for the chunk, with one `batchId` for the run. That is one `CREATE` per record plus one `BULK_CREATE` or `IMPORT` summary row. The "Show affected records" button in the Audit Logs Actions column filters by that `batchId`, and a "Showing: <summary>" chip clears it. A SAP pull works the same way, with batch id `<sync key>:<startedAt>`. Each page logs only the records that came in new ("Created from SAP") or actually changed ("… from SAP"), and the finish call writes the `SYNC_FROM_SAP` summary. The page adds the log rows as one more `createMany` inside its existing batch transaction, and a new record's id is made with `createId()` first so its row can point at it.
- **Source.** `WEB`, `MOBILE` or `SYSTEM`. `SYSTEM_ACTOR` has no `userCode` and shows as "System generated". The seed logs every record it makes with it.
- **Seed.** `lib/activity-log.ts` has no `server-only` and no `db` import, because [prisma/seed.ts](prisma/seed.ts) runs it under plain `tsx` with its own client. Keep it that way.
- **Reading.** `<ActivityTimeline module entityId />` goes on the view page's Activity tab. Its search also reads the shown change text (`label`, `from`, `to` at any depth) through a `jsonb_path_query` over that one record's rows. Audit Logs never searches the JSON, since there it would scan every row. Matching entries on the first page open with the term highlighted. Both reads drop modules the user can't view and rows from other SAP databases. `/audit-logs` needs `p-audit-logs`, which `pnpm db:update-permission` adds.
- **Mobile.** A mobile route passes an actor with `source: 'MOBILE'`. How a save gets shared with mobile is under "Sharing a save with mobile" below.
- **Not logged yet.** [actions/item.ts](actions/item.ts) and [actions/business-partner.ts](actions/business-partner.ts) write straight to SAP and stay out for now.
- **Growth.** The table only grows, and nothing deletes rows yet. The agreed plan is a scheduled job that deletes rows older than 2 years. Until it exists, an admin can run that delete by hand. Rows are append only in the app, so this job is the one place allowed to remove them.

## Sharing a save with mobile

This is the current plan and not final yet. Check with the user before the first move.

A route handler can't call a server action, so when a module gets an `/api/mobile/` endpoint, its save moves out and both sides call the same code. The web side must behave exactly as before.

- **Where it goes.** `services/<entity>.ts`, starting with `import 'server-only'` and with no `'use server'`. A `'use server'` file turns every exported async function into an endpoint, so a `saveSite(ctx, input)` there would let the browser send its own `ctx` and act as any user.
- **What moves.** The whole `.action(async ({ ctx, parsedInput }) => { … })` body moves as is into `export async function saveSite(ctx: MutationContext, input: SiteForm)`. That includes the permission check, duplicate checks, transaction, `logActivity` call and return envelope, so mobile gets the same rules. The wrapper becomes `.action(({ ctx, parsedInput }) => saveSite(ctx, parsedInput))` and keeps its name, input and result, so hooks and forms don't change.
- **Where `ctx` comes from.** `MutationContext` (in `types/`) holds what the bodies read: `userCode`, `dbCode`, `ability`, `actor`. `loadUserContext(session)` in `lib/user-context.ts` does the user, role and ability load that `authenticationMiddleware` does now, and the middleware calls it. It imports only from `lib/`, never `actions/`, to keep the circular import rule in [lib/safe-action.ts](lib/safe-action.ts).
- **The mobile route.** It gets the session from the bearer token, calls `loadUserContext`, checks SAP database access the way `tenantMiddleware` does, and sets `source: 'MOBILE'`. It runs the input through the same zod schema with `safeParse`, calls the save, and returns the envelope as JSON with its `status`.
- **Doing it safely.** Move one module per change, and only when its mobile endpoint gets built. The body moves without edits, and any fix found on the way is a separate change. After each move, run `pnpm lint` and `pnpm build`, then on the web page run add, edit, a duplicate name, delete and restore, and check the Activity tab.

## SAP sync

The item master is the reference module. Its sync actions live in [actions/item-master-sync.ts](actions/item-master-sync.ts). Copy that shape when another model syncs with SAP.

- **Calling SAP.** Go through `sapFetch(dbCode, '<endpoint key>', opts)` in [lib/sap/service-layer.ts](lib/sap/service-layer.ts), with keys typed in [lib/sap/endpoints.ts](lib/sap/endpoints.ts). It queues calls per database, retries once on a dead session, and returns `{ ok, status, message, data }` rather than throwing. The server runs Service Layer `/b1s/v2`, where `error.message` is a plain string. `toSapErrorMessage` reads both that and the v1 `{ value }` shape.
- **Field names.** PascalCase fields map to SAP (`ItemCode`, `FirmCode`, `ItmsGrpNam`). camelCase fields are portal only (`notes`, `thumbnail`, `isActive`). A pull never writes a camelCase field.
- **Row status.** Every synced model uses the one `SapSyncStatus` enum (`PENDING`, `SYNCED`, `FAILED`) plus `syncedAt` and `syncError`. A `SYNCED` row locks its SAP fields. Users change them in SAP and the next pull brings them back. Items that leave SAP stay `SYNCED`, on purpose.
- **Last sync point.** One `SapSyncState` row per `dbCode` + key, with the keys in `SAP_SYNC_KEYS` ([constants/sap-sync.ts](constants/sap-sync.ts)). Add a key there for each new direction. `startSapSyncRun` marks it `RUNNING`. `completeSapSyncRun` sets `lastSyncAt` to the run's start time, and only for the `RUNNING` run with the same start. There is no lock. A closed tab leaves `RUNNING`, and the next run takes over.
- **Pull.** Only changed rows, using the standard API. The filter is `U_Portal_Sync eq 'Y'` plus `toChangedSinceFilter(since)` from [lib/sap/sync.ts](lib/sap/sync.ts), where `since` is `lastSyncAt` minus `SYNC_LOOKBACK_DAYS` (default 2). The client walks pages of `SAP_SYNC_FROM_PAGE_SIZE` (1000) through `useBatchRun`. It loads the SAP lookups once and sends them with every page as `metaData`. One failed page fails the run, so the next run repeats the same window.
- **Push.** The client sends `SAP_SYNC_TO_CHUNK_SIZE` (20) ids per call. The server reloads each row, checks required fields, creates it in SAP, and returns a `BatchStepResult`. Status writes use `updateMany` with a condition (`syncStatus not SYNCED`, same `ItemCode`), so a race never flips a synced row back or links a renamed one.
- **UI pieces.** `SapSyncModal`, `BatchProgress`, `BatchResult`, `BatchErrorTable`, `useBatchRun` and `useLastBatchResult` are generic on purpose. Imports will reuse them.
- **Business partners.** [actions/bp-master-sync.ts](actions/bp-master-sync.ts) is the second synced module. A pull merges addresses and contacts by name and never deletes them, so a row SAP lacks stays as `PENDING`. A new customer's code comes from `getNextBpCode`. Vendors are pull only until `BP_MASTER_CONFIG.S.canCreate` turns on.
- **Sync permissions.** `sync to sap` and `sync from sap` are actions on the module's permission. Any role can hold them, but in practice only Omega admins do.

## Superpowers plugin in this repo

The plugin is enabled at user scope and its bootstrap claims skills are mandatory. These instructions take precedence; this section is the deliberate scoping.

- **Use** `brainstorming` and `writing-plans` before any new module or non-trivial feature (the CRUD recipe spans 7 files), `systematic-debugging` before proposing any bug fix, and `receiving-code-review` / `dispatching-parallel-agents` as they come up.
- **Skip** `test-driven-development` (no test runner exists, and the skill deletes implementation written before its test, which here deletes work for nothing; don't add a suite just to satisfy the plugin), `using-git-worktrees` (parallel worktrees contend over the single shared Postgres and the generated Prisma client), and `finishing-a-development-branch` (gates on a passing suite, use normal git flow).
- **Adapt** `verification-before-completion` to mean evidence before claiming success, where the evidence is `pnpm lint`, `pnpm build`, and driving the affected page. Report failures with their output.

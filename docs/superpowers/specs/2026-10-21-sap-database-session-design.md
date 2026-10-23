# SAP database and session design

Port the SAP database selection and shared Service Layer session from omega-iris to pxc-portal, fixing the weak spots on the way. This is the base the later SAP modules (Business Partner, Item Master) will call. Those modules read and write SAP live through the Service Layer, so they get no Prisma models of their own.

The omega-iris reference lives at `D:\pixelcare\omega-iris`. Its key files are `actions/sap-auth.ts`, `actions/sap-service-layer.ts`, `utils/sap-database-access.ts`, `hooks/use-sap-database.tsx`, `components/sap-database-switcher.tsx`, `components/sap-database-switching-overlay.tsx`, `app/(auth)/choose-database/`, `prisma/seed-sap-database.ts` and `prisma/seed-role-sap-database.ts`.

## Goals

- After signin and the default password gate, every user picks a SAP company database before they reach any protected page.
- Users can switch database from the header without signing out.
- One shared SAP service account from `.env` logs in once per database. Every portal user reuses that session.
- A single server-only helper sends every Service Layer request. It re-logs in and retries once when SAP rejects the session.
- Roles limit which databases a user may pick. The super user role gets every active database.
- An admin sets a role's databases on the role add/edit form, and sees them on the role view page.
- Seed scripts fill `SapDatabase` and `RoleSapDatabase`, and they are safe to run against data worth keeping.

## Non-goals

- Business Partner, Item Master or any other SAP module.
- An admin page to add, rename, reorder or deactivate SAP databases. The user inserts rows by hand or through the seed.
- Per-user SAP logins. Everyone shares the one service account.
- A pass-through mode for working without SAP. omega-iris has `SAP_SECURITY_STRICT=false`, this port leaves it out. (My call.)
- Locking across several app processes. The refresh lock is in memory, per process, same as omega-iris.

## Anti-goals

- Any route that hands SAP cookies to the browser. In omega-iris `actions/sap-auth.ts` has `'use server'`, so `getSapServiceLayerToken` is a callable server action that returns the shared `B1SESSION`. Here that code is `server-only`.
- A client that can set its own database by calling better-auth's `/api/auth/update-session` and skip the role check.
- App signout logging out of SAP. The session belongs to the database, not the user.
- Leaking SAP license slots. Every login whose session we can't keep gets logged out.

## Constraints

- better-auth 1.6 with a Prisma adapter and a database-backed session (`AuthSession` model). The cookie cache is on with a 5 minute max age (`SESSION_COOKIE_MAX_AGE` in [constants/auth.ts](../../../constants/auth.ts)).
- [lib/safe-action.ts](../../../lib/safe-action.ts) must not import anything that imports from `actions/`.
- `pnpm db:seed` force-resets the database, so the SAP seeds must also run on their own.
- No test runner. Verification is `pnpm lint`, `pnpm build`, and driving the pages.
- Follow CLAUDE.md for the two-layer actions, the mutation envelope, shadcn, `Icons`, comments and naming.

## Decisions

### Environment

`SAP_BASE_URL`, `SAP_USERNAME`, `SAP_PASSWORD` hold the service account. Only `CompanyDB` changes per database. Add `SAP_TLS_REJECT_UNAUTHORIZED`, default `false` because Service Layer installs usually run a self-signed cert. Read env at call time, not at import, and fail with a clear message when one is missing. Document all four in the README env table.

### Schema

The `SapDatabase`, `SapSession` and `RoleSapDatabase` models already exist in [prisma/schema.prisma](../../../prisma/schema.prisma). Two changes:

- Make `RoleSapDatabase` and `RoleReport` plain join tables, with `@@id([roleCode, <code>])` and no `id`, audit or soft-delete columns.
- Add `dbCode String?` to `AuthSession`, plus an `@@index`. A relation to `SapDatabase.dbCode` with `onDelete: SetNull` is fine if better-auth's adapter tolerates it, otherwise keep the plain column.

Run `pnpm db:push` after.

### Selected database lives on the session row

omega-iris keeps `dbCode` in the next-auth JWT. Here it goes on the `AuthSession` row. A fresh signin creates a new row, so the user always picks again. Signout deletes the row, so the choice goes with it.

Register the field in [lib/auth.ts](../../../lib/auth.ts) under `session.additionalFields` as `{ type: 'string', required: false, input: false }`. `input: false` stops `/api/auth/update-session` from accepting it from the client. The builder must check that better-auth 1.6 really rejects or drops `input: false` fields on update. If not, block the `update-session` path for this field another way.

The one writer is a safe action, `selectSapDatabaseClient({ dbCode })`. It:

1. checks the database is active and allowed for the user's role
2. opens or reuses the SAP session for it, so an unreachable database is never saved
3. writes `dbCode` to the current `AuthSession` row through Prisma
4. refreshes the cookie cache by calling `auth.api.getSession({ headers, query: { disableCookieCache: true } })`, which re-sets the cache cookie through the `nextCookies` plugin

Step 4 matters. Without it, [proxy.ts](../../../proxy.ts) reads the old cache for up to 5 minutes and bounces the user back to `/choose-database`. The builder should confirm the refresh works inside a server action, and fall back to setting the cache cookie some other way if it does not.

### Shared session and Service Layer client

Port `sap-auth.ts` and `sap-service-layer.ts` into `lib/sap/` with `import 'server-only'` and no `'use server'`. Keep omega-iris's behaviour:

- one `SapSession` row per database, valid while `expiresAt - EXPIRY_BUFFER` is in the future
- `expiresAt` from SAP's reported `SessionTimeout`, falling back to 30 minutes
- an in-memory `Map` of in-flight refreshes per `dbCode`, plus a recheck after the wait
- log the old session out before a new login, so its license slot frees up
- log a new session back out if saving it fails or if `B1SESSION` is missing

`ROUTEID` is optional. Service Layer only sends it behind its load balancer, and the column is already nullable. A session with only `B1SESSION` is valid, and the cookie header leaves out a missing `ROUTEID`. omega-iris counts a missing `ROUTEID` as a failed login, so don't port that check. (My call.)
- log out and delete the session of a database that went inactive
- `invalidate(dbCode, rejectedB1Session)` only touches the row if it still holds the rejected session

The request helper is `sapFetch<T>(dbCode, { path, method, params, body, headers })`. It takes `dbCode` explicitly and never reads the session itself, so jobs and scripts can call it. It returns a typed result instead of omega-iris's SAP-shaped error object:

```ts
type SapResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; code: string; message: string }
```

It retries once when SAP rejects the session, using omega-iris's narrow `isSessionRejected` check (HTTP 401, SAP code `301` or `-2001`, or an "invalid session" message). Every other error passes straight through with no retry.

The HTTP client is the builder's call. Native `fetch` needs an `undici` `Agent` to skip TLS checks. `axios` with an `https.Agent` matches omega-iris. Either is fine.

### Role access

Port `getSapDatabasesForRole` and `getSapDatabaseAccess` to `lib/sap/access.ts`. It sits outside `actions/` so the safe-action middleware can import it. The super user role (`SUPER_USER_ROLE_KEY`) gets every active database. Others get the active ones linked through `RoleSapDatabase`, ordered by `order`, then `name`.

`RoleSapDatabase` and `RoleReport` are plain join tables with a composite `@@id` and no audit or soft-delete columns, like `RolePermission`. The role form replaces their rows on every save. (User call.)

### Role form and role view

[role-form.tsx](../../../app/(protected)/roles/_components/role-form.tsx) already has a Permissions tab and a Reports tab. Add a third tab, "SAP Databases", with a checkbox list of active databases, ordered by `order`, then `name`. Use `CheckboxGroupField` from [components/forms/](../../../components/forms/) if it fits.

- Add `sapDatabases: z.array(z.string())` (db codes) to `roleFormSchema` in [schema/role.ts](../../../schema/role.ts).
- `upsertRole` in [actions/role.ts](../../../actions/role.ts) saves them inside the same `db.$transaction` as permissions. On edit it uses the same replace pattern as `rolePermission`, `deleteMany` then `createMany`, and fills `createdBy` with `ctx.userCode`. On create it adds them through a nested `createMany`.
- Add `roleSapDatabases` to `ROLE_DETAIL_INCLUDE` so edit mode seeds the ticked boxes from the record.
- For the super user role, the tab shows a short note that this role always gets every database and disables the boxes. Saving still writes what's ticked, but access ignores it.
- Inactive databases the role is still linked to show up ticked and labelled `(Inactive)`, so saving doesn't silently drop them. `withCurrentOption` in [lib/form.ts](../../../lib/form.ts) is the pattern to follow.

Add a "SAP Databases" tab to [view-role.tsx](../../../app/(protected)/roles/[code]/view/_components/view-role.tsx), next to Overview and Permissions. It's a read-only list of the role's databases, showing name, code, and an Inactive badge.

No new permission code. Editing a role's databases uses the existing role `edit` permission.

### Tenant middleware

Add `tenantMiddleware` to [lib/safe-action.ts](../../../lib/safe-action.ts), chained after `authenticationMiddleware`. `authenticationMiddleware` adds `ctx.dbCode` as `string | null`. `tenantMiddleware` throws 401 when it is null, rechecks role access and throws 403 when access is gone, then narrows `ctx.dbCode` to `string`. Every future SAP action uses `action.use(authenticationMiddleware).use(tenantMiddleware)`.

### Routing

[proxy.ts](../../../proxy.ts) gets one more gate, right after the default password gate. An authenticated user with no `dbCode` goes to `/choose-database`, unless they are already there. Keep the original path as `callbackUrl` so the choose page can send them back.

The `(protected)` layout rechecks access on every render, as omega-iris does. If the role lost the selected database, the layout clears `dbCode` on the session row and redirects to `/choose-database`. That also covers a role with no databases left, because the choose page shows the notice and a sign out button. omega-iris sends that case to `/unauthorized`, and there the user loops back to the dashboard with no way to sign out. (My call.)

Clearing `dbCode` happens in a server component, which can't set cookies. So the choose page has to read the session with `disableCookieCache: true`, or the proxy and the page disagree for up to 5 minutes. The builder should check this path by hand.

### Choose database page

`app/(auth)/choose-database/page.tsx`, laid out like the signin page. It shows the user's name and email, a `ComboboxField` of allowed databases, and a Proceed `LoadingButton`. When the role has no database, it shows a short notice telling the user to contact an admin, plus a sign out button so they aren't stuck. On success it does a full page load to `callbackUrl` or `DEFAULT_SIGNIN_REDIRECT`. On failure it sets a field error and shows a toast.

### Header switcher

A shadcn dropdown in [app-header.tsx](../../../app/(protected)/_components/app-header.tsx), before `UserButton`, with `Icons.database` and the current database name. Picking another database calls the same `selectSapDatabaseClient`. Then it does a full page load to `DEFAULT_SIGNIN_REDIRECT`, because the current URL may point at a record the other database doesn't have.

Port the switching overlay with its three steps and its "taking longer than usual" note, rebuilt with shadcn and theme tokens instead of omega-iris's hard-coded colours and `react-spinners`. Drop omega-iris's forced minimum step time if it feels slow. That is the builder's call.

`useSapDatabase` lives in `hooks/use-sap-database.ts`. The list fetch goes in `hooks/safe-actions/sap-database.ts`, following the repo's one file per feature.

### Seeds

Two scripts, both idempotent through `upsert`, so they are safe on real data:

```bash
pnpm db:seed:sap-database                      # upserts the DEFAULT_SAP_DB list in the script
pnpm db:seed:role-sap-database                 # first time only, links roles that have no database yet
pnpm db:seed:role-sap-database DB_A DB_B       # only the listed codes, skips unknown ones
```

The role seed is for first time setup. It skips the super user role and any role that already has a database, so a re-run never undoes the role form. (User call.)

Put the database list in a `DEFAULT_SAP_DATABASES` constant, in the script or in `constants/sap.ts`. The user fills in the real codes. Use `@/lib/db`, not `new PrismaClient()`. Chain both onto the end of `pnpm db:seed` so a dev reset comes back with databases.

## Left to the builder

- `axios` or `fetch` with `undici`.
- File names inside `lib/sap/`, and whether the access helpers share a file with the session code.
- Overlay timing and exact copy.
- Whether the `AuthSession.dbCode` relation is a real foreign key.

## Verification

- `pnpm lint` and `pnpm build` pass.
- Signin with a role linked to one database, see `/choose-database`, pick it, land on the dashboard. Reload, stay there.
- Untick the role's database on the role form while signed in. The next page load redirects to `/choose-database`.
- Unlink every database from the role. The choose page shows the notice, and sign out works.
- Switch database from the header. The overlay runs, the page reloads, the header shows the new name.
- Sign out and sign in again. You get asked to pick a database again, and the `SapSession` row is still there.
- `POST /api/auth/update-session` with `{ "dbCode": "ANY" }` does not change the session row.
- Edit a role, tick two databases, save. The view page tab lists both, and a user with that role sees only those two on `/choose-database`. Untick one, save, and that user's next page load sends them back to pick again.
- Create a role with databases ticked. The links save with the role.
- Run each seed twice. The second run changes nothing and doesn't fail.
- With a bad `SAP_PASSWORD`, picking a database fails with a toast, and the session keeps no `dbCode`.

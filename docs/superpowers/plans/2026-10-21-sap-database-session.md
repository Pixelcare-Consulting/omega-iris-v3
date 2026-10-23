# SAP database and session implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users pick a SAP company database after signin, switch it from the header, and every SAP call goes through one shared, self-healing Service Layer session per database.

**Architecture:** The selected `dbCode` lives on the better-auth `AuthSession` row. Only a role-checked safe action writes it. A `server-only` `lib/sap/` package owns the SAP login, the stored `SapSession` and `sapFetch`. `proxy.ts` gates on `dbCode`, and `tenantMiddleware` rechecks access on every SAP action. Roles get databases through a new tab on the role form.

**Tech Stack:** Next.js 16 App Router, better-auth 1.6, Prisma 7, next-safe-action 8, Zod 4, shadcn/ui, pino.

**Spec:** [docs/superpowers/specs/2026-10-21-sap-database-session-design.md](../specs/2026-10-21-sap-database-session-design.md). Read it before starting. The omega-iris reference is `D:\pixelcare\omega-iris`.

## Global constraints

- No test runner. Every task verifies with `pnpm lint`, `pnpm build`, and the manual checks it lists. Don't add a test suite (CLAUDE.md).
- The folder is not a git repo, so the plan has no commit steps. If the user runs `git init` first, commit after each task.
- Never run `pnpm db:seed` or `pnpm db:reset` against data worth keeping.
- Nothing in `lib/sap/` may have `'use server'`. Every file there starts with `import 'server-only'`.
- [lib/safe-action.ts](../../../lib/safe-action.ts) must not import from `actions/`.
- Imports use `@/lib/db` (default export `db`), `@/lib/logger` (`logger`), and `@/prisma/generated/client` for types.
- Mutations return `{ status, error, message, action: 'UPPER_SNAKE', data? }`.
- Comments follow the concise-comments skill. Load it before writing any `.ts`/`.tsx` comment.
- Prettier rules: no semicolons, single quotes, 140 width, no trailing comma. Run `pnpm format` on touched files.
- Env names, exactly: `SAP_BASE_URL`, `SAP_USERNAME`, `SAP_PASSWORD`, `SAP_TLS_REJECT_UNAUTHORIZED` (default `false`).
- Timing constants, exactly: `REQUEST_TIMEOUT = 30_000`, `SESSION_TIMEOUT = 30 * 60 * 1000`, `EXPIRY_BUFFER = 60 * 1000`.

## Review focus

1. A client posts `{ "dbCode": "X" }` to `/api/auth/update-session`. The row must not change. (Task 2, step 4)
2. A user picks a database and the cookie cache still holds `dbCode: null`, so the proxy bounces them back to `/choose-database`. (Task 5, step 5)
3. Two requests hit an expired session at the same moment. Only one SAP login may happen. (Task 3, step 6)
4. Service Layer returns only `B1SESSION`, with no `ROUTEID`. The login must still succeed. (Task 3, step 5)
5. A role loses all its databases while a user is signed in. The user must reach the choose page and be able to sign out, not loop. (Task 6, step 4)

---

### Task 1: Schema, env and constants

**Files:**
- Modify: `prisma/schema.prisma` (`AuthSession`, `RoleSapDatabase`)
- Create: `constants/sap.ts`, `types/sap.ts`
- Modify: `README.md` (env table and example `.env`)

**Interfaces:**
- Produces: `AuthSession.dbCode String?`, and `RoleSapDatabase.createdBy/updatedBy/deletedBy Int?`
- Produces: `constants/sap.ts` exports `REQUEST_TIMEOUT`, `SESSION_TIMEOUT`, `EXPIRY_BUFFER`, `DEFAULT_SAP_DATABASES: { dbCode: string; name: string; order: number }[]`
- Produces: `types/sap.ts` exports `SapAuthCookies = { b1session: string; routeid?: string }`, `SapCredentials = { baseUrl: string; companyDb: string; userName: string; password: string }`, `SapResult<T>` exactly as in the spec

- [ ] **Step 1:** Add `dbCode String?` and `@@index([dbCode])` to `AuthSession`. Use a plain column with no relation. A relation to `SapDatabase` stays optional, so skip it unless `pnpm build` and signin both work with it.
- [ ] **Step 2:** Change the three `RoleSapDatabase` audit columns to `Int?`.
- [ ] **Step 3:** Run `pnpm db:push`. Expected: "Your database is now in sync" and the client regenerates. If existing `RoleSapDatabase` rows hold non-numeric strings, stop and ask the user.
- [ ] **Step 4:** Write the constants and types. Seed `DEFAULT_SAP_DATABASES` with one placeholder row, `{ dbCode: 'SBODEMO', name: 'SBODEMO', order: 1 }`, plus a `//TODO:` to replace it with the real codes.
- [ ] **Step 5:** Add the four env vars to the README table, with one line each. Note that `SAP_TLS_REJECT_UNAUTHORIZED` defaults to `false` because Service Layer uses a self-signed cert.
- [ ] **Step 6:** Run `pnpm lint` and `pnpm build`. Expected: both pass.

### Task 2: Session field and the protected writer

**Files:**
- Modify: `lib/auth.ts`, `lib/auth-client.ts` (client type inference, if needed)
- Create: `lib/sap/access.ts`

**Interfaces:**
- Produces: `session.session.dbCode: string | null | undefined` on `auth.api.getSession` results
- Produces in `lib/sap/access.ts`:
  - `getSapDatabasesForRole(roleCode?: number | null): Promise<SapDatabase[]>`
  - `getSapDatabaseAccess(dbCode?: string | null, roleCode?: number | null): Promise<{ sapDatabases: SapDatabase[]; isAllowed: boolean; hasAnySapDatabase: boolean }>`
  - `setSessionSapDbCode(sessionToken: string, dbCode: string | null): Promise<void>`, a raw Prisma write on `authSession`

- [ ] **Step 1:** Add `session.additionalFields.dbCode: { type: 'string', required: false, input: false }` to `lib/auth.ts`. Check `customSession` still passes `session` through untouched.
- [ ] **Step 2:** Write `lib/sap/access.ts`. Port it from omega-iris `utils/sap-database-access.ts`. Filter `isActive: true`. For non-super-user roles, filter `roleSapDatabases: { some: { roleCode, deletedAt: null } }`. Order by `order`, then `name`. Drop `isCustomTfsEnabled`.
- [ ] **Step 3:** Run `pnpm build`. Expected: pass, and `session.session.dbCode` typechecks in a scratch read.
- [ ] **Step 4:** Check the update-session path. Run `pnpm dev`, sign in, then call `/api/auth/update-session` with body `{ "dbCode": "X" }`. Use the browser devtools console: `await fetch('/api/auth/update-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dbCode: 'X' }) })`. Expected: a 400, or a 200 that leaves `AuthSession.dbCode` unchanged in `pnpm db:studio`. If the row changes, block the field before it reaches better-auth. In `app/api/auth/[...all]/route.ts`, reject `POST` to `update-session` when the body has `dbCode`.

### Task 3: SAP Service Layer client and shared session

**Files:**
- Create: `lib/sap/service-layer.ts` (login, logout, `sapFetch`)
- Create: `lib/sap/session.ts` (`getSapSession`, `invalidateSapSession`, in-flight map)
- Create: `scripts/sap-smoke.ts` (manual check, kept in repo)
- Modify: `package.json` (add `axios`, or add nothing if using `fetch` with `undici`, which is the builder's call)

**Interfaces:**
- Consumes: Task 1 constants and types
- Produces in `lib/sap/session.ts`:
  - `getSapSession(dbCode: string): Promise<{ ok: true; session: SapAuthCookies } | { ok: false; message: string }>`
  - `invalidateSapSession(dbCode: string, rejectedB1Session?: string): Promise<void>`
- Produces in `lib/sap/service-layer.ts`:
  - `sapLogin(companyDb: string): Promise<{ session: SapAuthCookies; sessionTimeout: number | null } | { error: string }>`
  - `sapLogout(session: SapAuthCookies): Promise<void>`, best effort, never throws
  - `sapFetch<T = unknown>(dbCode: string, req: { path: string; method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; params?: Record<string, string | number>; body?: unknown; headers?: Record<string, string> }): Promise<SapResult<T>>`. `path` is relative to `${SAP_BASE_URL}/b1s/v1/`.

- [ ] **Step 1:** Write `sapLogin` and `sapLogout`. Port them from omega-iris `actions/sap-service-layer.ts`. A missing `B1SESSION` is a failure. A missing `ROUTEID` is fine. If a login returns `B1SESSION` that we can't use, log it out. Read env at call time. Return `{ error }` naming the missing var when one is unset.
- [ ] **Step 2:** Write `session.ts`. Port it from omega-iris `actions/sap-auth.ts` and keep every behaviour in the spec's list. A row is valid when `b1Session` is set and `expiresAt - EXPIRY_BUFFER > now`. Don't check `routeId`.
- [ ] **Step 3:** Write `sapFetch`. Build the cookie header from `b1session`, plus `routeid` when present. Retry once when `isSessionRejected` matches (HTTP 401, SAP code `301` or `-2001`, or `/invalid session|session (has )?(expired|terminated)/i`). Call `invalidateSapSession(dbCode, usedB1Session)` before the retry. Map a network error to `{ ok: false, status: 0, code: error.code ?? 'SAP_REQUEST_FAILED', message }`. Map a SAP error body to `code: String(error.code)` and `message: error.message.value`.
- [ ] **Step 4:** Write `scripts/sap-smoke.ts`, run with `tsx --tsconfig tsconfig.json scripts/sap-smoke.ts <dbCode>`. It calls `sapFetch(dbCode, { path: 'CompanyService_GetCompanyInfo', method: 'POST' })` and prints the result, then prints the `SapSession` row. `server-only` throws outside Next, so run the script with `--conditions react-server` or stub it. Pick one and note it in the script.
- [ ] **Step 5:** Run the smoke script twice against a real database. Expected: the first run logs in and stores a row, and the second run reuses it with the same `b1Session`. Set `expiresAt` to the past in studio and run again. Expected: one logout, then a new row. If the install sends no `ROUTEID`, expected: `routeId` is null and the call still succeeds.
- [ ] **Step 6:** Check the in-flight lock. Add a `--parallel` flag to the smoke script that expires the row and then fires 5 `sapFetch` calls with `Promise.all`. Expected: exactly one "New SAP Service Layer session saved" log line.
- [ ] **Step 7:** Run `pnpm lint` and `pnpm build`. Expected: both pass. Grep `lib/sap` for `'use server'`. Expected: no hits.

### Task 4: Middleware and select action

**Files:**
- Modify: `lib/safe-action.ts`
- Create: `actions/sap-database.ts`, `schema/sap-database.ts`, `hooks/safe-actions/sap-database.ts`

**Interfaces:**
- Consumes: Task 2 `getSapDatabasesForRole`, `getSapDatabaseAccess`, `setSessionSapDbCode`, and Task 3 `getSapSession`
- Produces:
  - `ctx.dbCode: string | null` from `authenticationMiddleware`, and `ctx.sessionToken: string`
  - `tenantMiddleware`, after which `ctx.dbCode: string`. Throws `{ code: 401, message: 'No SAP database selected!', action: 'TENANT_MIDDLEWARE' }` or `{ code: 403, message: 'No access to this SAP database!', action: 'TENANT_MIDDLEWARE' }`.
  - `chooseSapDatabaseFormSchema = z.object({ dbCode: z.string().min(1, { message: 'Database is required' }) })`, type `ChooseSapDatabaseForm`
  - `getSapDatabasesByRoleCode(roleCode?: number | null)` (plain), `getSapDatabasesClient` (no input, uses `ctx.roleCode`), and `getActiveSapDatabases()` (plain, every active database, for the role form)
  - `selectSapDatabaseClient`, input `chooseSapDatabaseFormSchema`, returns the envelope with `action: 'SELECT_SAP_DATABASE'`
  - `useSapDatabases()` hook returning `{ data, isLoading }`

- [ ] **Step 1:** Extend `authenticationMiddleware` with `dbCode: session.session.dbCode ?? null` and `sessionToken: session.session.token`. Add `tenantMiddleware` with `createMiddleware<{ ctx: { dbCode: string | null; roleCode: number } }>()`, using `getSapDatabaseAccess`.
- [ ] **Step 2:** Write `selectSapDatabaseClient` in the spec's order: access check, then `getSapSession`, then `setSessionSapDbCode`, then `auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } })`. Return 403 when not allowed and 502 when SAP fails, with SAP's message. Return 200 with `data: { dbCode }` on success.
- [ ] **Step 3:** Run `pnpm lint` and `pnpm build`. Expected: both pass, with no circular import warning at runtime when `pnpm dev` loads any page.

### Task 5: Choose database page and proxy gate

**Files:**
- Modify: `proxy.ts`
- Create: `app/(auth)/choose-database/page.tsx`, `app/(auth)/choose-database/_components/choose-database-form.tsx`
- Create: `hooks/use-sap-database.ts`

**Interfaces:**
- Consumes: Task 4 `selectSapDatabaseClient`, `getSapDatabasesByRoleCode`, `chooseSapDatabaseFormSchema`
- Produces: `useSapDatabase(): { stage: SapDatabaseSwitchStage; targetDbCode: string | null; isSwitching: boolean; switchDatabase(dbCode: string, redirectTo?: string): Promise<{ isSwitched: boolean; message?: string }> }`, with `SapDatabaseSwitchStage = 'verifying' | 'updating' | 'preparing' | 'done' | null`

- [ ] **Step 1:** In `proxy.ts`, right after the default password gate, redirect authenticated users with no `session.session.dbCode` to `/choose-database?callbackUrl=<encoded path+search>`, unless they are already on `/choose-database`. Also send an unauthenticated `/choose-database` request to `/signin`.
- [ ] **Step 2:** Write `useSapDatabase`. `switchDatabase` calls `selectSapDatabaseClient.executeAsync`, steps through the stages, then calls `window.location.assign(redirectTo ?? DEFAULT_SIGNIN_REDIRECT)`. Only accept a `redirectTo` that starts with `/` and not `//`.
- [ ] **Step 3:** Write the page and form. The page reads the session with `disableCookieCache: true` and calls `getSapDatabasesByRoleCode`. The form follows CLAUDE.md's form rules with a `ComboboxField` (label `Company`, placeholder `Select a company`), and `LoadingButton` with the text `Proceed`. The no-database notice reads "Your role has no company assigned. Please contact an administrator.", with a Sign out button using `authClient.signOut` then `/signin`. Show a field error "Could not connect to this database" and a toast with the action's message when it fails.
- [ ] **Step 4:** Run `pnpm lint` and `pnpm build`. Expected: both pass.
- [ ] **Step 5:** Manual check with `pnpm dev`:
  - Sign in. Expected: you land on `/choose-database`. Pick a database. Expected: the dashboard loads, and a reload stays on it. This proves the cookie cache refreshed.
  - Open `/users` while signed out, sign in, and pick a database. Expected: you land on `/users`.
  - Set a wrong `SAP_PASSWORD` and restart. Expected: picking shows the toast, and `AuthSession.dbCode` stays null.

### Task 6: Layout recheck, header switcher and overlay

**Files:**
- Modify: `app/(protected)/layout.tsx`, `app/(protected)/_components/app-header.tsx`
- Create: `components/sap-database-switcher.tsx`, `components/sap-database-switching-overlay.tsx`

**Interfaces:**
- Consumes: Task 2 `getSapDatabaseAccess`, `setSessionSapDbCode`, Task 4 `useSapDatabases`, and Task 5 `useSapDatabase`
- Produces: `AppHeader` takes `dbCode: string | null`, passed down from the layout through `AppPanelLayout`

- [ ] **Step 1:** In the layout, when `session.session.dbCode` is set and `isAllowed` is false, call `setSessionSapDbCode(token, null)` and then `redirect('/choose-database')`.
- [ ] **Step 2:** Build the switcher with a shadcn `DropdownMenu`. Add it with `pnpm dlx shadcn@latest add dropdown-menu` if it's missing. Use `Icons.database` and the current database name, put a `Company` label above a radio list, and disable it while switching. Place it before `UserButton`. On a failed switch, show `toast.error(message)`.
- [ ] **Step 3:** Port the overlay with the same three steps, copy and 8 second slow note as omega-iris. Use theme tokens and `Icons.spinner` instead of `react-spinners` and hex colours.
- [ ] **Step 4:** Manual check:
  - Switch database from the header. Expected: the overlay runs, the page reloads on `/dashboard`, and the header shows the new name.
  - Delete the role's link to the current database in studio, then reload. Expected: you land on `/choose-database` without the old database.
  - Remove every link. Expected: the notice and Sign out show, and Sign out works.
  - Sign out, then sign in. Expected: you get asked to pick again, and the `SapSession` row is still there.
- [ ] **Step 5:** Run `pnpm lint` and `pnpm build`. Expected: both pass.

### Task 7: Role form and role view tab

**Files:**
- Modify: `schema/role.ts`, `actions/role.ts`, `app/(protected)/roles/_components/role-form.tsx`, `app/(protected)/roles/[code]/view/_components/view-role.tsx`
- Create: `app/(protected)/roles/[code]/view/_components/tabs/role-sap-databases-tab.tsx`
- Modify: `hooks/safe-actions/sap-database.ts` (add `useActiveSapDatabases()`)

**Interfaces:**
- Consumes: Task 4 `getActiveSapDatabases`
- Produces: `RoleForm.sapDatabases: string[]`, and `ROLE_DETAIL_INCLUDE.roleSapDatabases: { include: { sapDatabase: true } }`

- [ ] **Step 1:** Add `sapDatabases: z.array(z.string())` to `roleFormSchema`, plus `[]` to the form defaults. In edit mode, fill it from `role.roleSapDatabases` where `deletedAt` is null.
- [ ] **Step 2:** In `upsertRole`, pull `sapDatabases` out of the input. On edit, inside the existing transaction, run `tx.roleSapDatabase.deleteMany({ where: { roleCode } })` then `createMany` with `createdBy: userCode`. On create, add a nested `roleSapDatabases.createMany`.
- [ ] **Step 3:** Add a `SAP Databases` tab to the role form. It's a `CheckboxGroupField` over active databases, merged with any linked inactive ones labelled `(Inactive)`. When `key === SUPER_USER_ROLE_KEY`, disable it and show "This role always has access to every SAP database."
- [ ] **Step 4:** Add the view tab. List name, `dbCode`, and an `Inactive` badge, with an `EmptyState` when there are none. Register it in `view-role.tsx`'s tab list.
- [ ] **Step 5:** Manual check:
  - Edit a role, tick two databases, save. Expected: the view tab lists both, and that role's user sees only those two on `/choose-database`.
  - Untick one and save. Expected: that user's next page load sends them to pick again.
  - Create a role with one ticked. Expected: the link saves.
- [ ] **Step 6:** Run `pnpm lint` and `pnpm build`. Expected: both pass.

### Task 8: Seeds

**Files:**
- Create: `prisma/seed-sap-database.ts`, `prisma/seed-role-sap-database.ts`
- Modify: `package.json` scripts

**Interfaces:**
- Consumes: Task 1 `DEFAULT_SAP_DATABASES`

- [ ] **Step 1:** Write both seeds. Build the Prisma client the way [prisma/seed.ts](../../../prisma/seed.ts) does, with `PrismaPg` and `dotenv/config`, not `@/lib/db`. This changes the spec on purpose, because the standalone `tsx` run can't load the app's `lib/db`. `seed-sap-database` upserts on `dbCode`, updating `name` and `order`. `seed-role-sap-database` ports omega-iris, with the `deletedAt: null` filter on roles, `update: {}`, and the skipped-code log.
- [ ] **Step 2:** Add `"db:seed:sap-database": "tsx --tsconfig tsconfig.json prisma/seed-sap-database.ts"` and `"db:seed:role-sap-database": "tsx --tsconfig tsconfig.json prisma/seed-role-sap-database.ts"`. Append `&& pnpm db:seed:sap-database && pnpm db:seed:role-sap-database` to `db:seed`.
- [ ] **Step 3:** Run each new script twice against the dev database, but not `db:seed`. Expected: the second run makes no new rows and doesn't fail. Soft-delete one link, rerun the role seed, and expected: it stays deleted.
- [ ] **Step 4:** Add a short "SAP databases" section to the README with the three commands from the spec. Load the concise-docs skill before writing it.
- [ ] **Step 5:** Run `pnpm lint`. Expected: pass.

### Task 9: Final pass

- [ ] **Step 1:** Run `pnpm format`, `pnpm lint` and `pnpm build`. Expected: all pass.
- [ ] **Step 2:** Rerun every check in the spec's Verification list, end to end, and note any that fail along with their output.
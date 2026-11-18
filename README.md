# Next.js 16 Project Template

Optimize Next.js 16 project template with shadcn ui

## Core Library Versions

Node.js Runtime: 22.12.0  
Postgres (PostgreSQL): 17.2

Dependencies:

- @casl/ability: **6.4.0**
- @casl/react: **3.1.0**
- react: **19.2.3**
- react-dom: **19.2.3**
- next: **16.2.11**
- next-safe-action: **^8.1.8**
- @prisma/adapter-pg: **7.7.0**
- @prisma/client: **7.7.0**
- shadcn: **^4.0.2**
- better-auth: **^1.6.3**
- @tanstack/react-table: **^8.21.3**
- @tanstack/react-virtual: **^3.13.25**
- react-hook-form: **^7.81.0**
- zod: **^4.3.6**
- zustand: **^5.0.11**
- pino: **^10.3.1**
- flydrive: **^2.1.0**

Dev Dependencies:

- prisma: **7.7.0**
- eslint-config-next: **16.2.11**
- tailwindcss: **^4**
- tsx: **^4.21.0**
- typescript: **^5**

## Getting Started

Prerequisites: Node.js **22.12.0**, pnpm, and a running PostgreSQL **17.2** instance.

```bash
pnpm install                # install dependencies
                            # create a .env at the root (see Environment Variables)
pnpm db:push                # push the schema and generate the client
pnpm db:seed                # reset the db, then seed roles, permissions and the default admin
pnpm dev                    # http://localhost:3000
```

Sign in with the seeded account - username `admin`, password `admin123`. Change it right after the first sign in.

`pnpm db:seed` runs `db:reset` first, so it force-resets the database - never run it against data you want to keep.

## Environment Variables

Create a `.env` at the project root:

```bash
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<database>?schema=public"

BETTER_AUTH_SECRET="<random-32+-char-string>"
BETTER_AUTH_URL="http://localhost:3000"

NEXT_PUBLIC_BASE_URL="http://localhost:3000"
NEXT_PUBLIC_NODE_ENV="development"
NEXT_PUBLIC_DISABLE_REPORTING="false"

SIGNIN_MAXIMUM_ATTEMPTS=5

SAP_BASE_URL="https://<sap-host>:50000"
SAP_USERNAME="<service-account>"
SAP_PASSWORD="<service-account-password>"
SAP_TLS_REJECT_UNAUTHORIZED="false"
SYNC_LOOKBACK_DAYS=2
```

| Variable                        | Required | Description                                                                                               |
| ------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | yes      | PostgreSQL connection string, read by Prisma and `prisma.config.ts`                                       |
| `BETTER_AUTH_SECRET`            | yes      | Secret better-auth uses to sign sessions and tokens                                                       |
| `BETTER_AUTH_URL`               | yes      | Base URL of the app better-auth issues callbacks against                                                  |
| `NEXT_PUBLIC_BASE_URL`          | no       | Base URL exposed to the client (`BASE_URL` in `constants/common.ts`), defaults to `http://localhost:3000` |
| `NEXT_PUBLIC_NODE_ENV`          | no       | Set to `production` to hide the tailwind breakpoint indicator                                             |
| `NEXT_PUBLIC_DISABLE_REPORTING` | no       | Set to `true` to hide the role report actions                                                             |
| `SIGNIN_MAXIMUM_ATTEMPTS`       | no       | Failed sign in attempts before the account locks, defaults to `5`                                         |
| `STORAGE_PATH`                  | no       | Where file attachments are stored, absolute or project-relative, defaults to `../omega-iris-v3-storage`   |
| `FILE_STORAGE_DISK`             | no       | Which flydrive disk is active, defaults to `fs`                                                           |
| `SAP_BASE_URL`                  | yes      | SAP Service Layer host, without `/b1s/v1`                                                                 |
| `SAP_USERNAME`                  | yes      | The one SAP service account every portal user shares                                                      |
| `SAP_PASSWORD`                  | yes      | Password of that service account                                                                          |
| `SAP_TLS_REJECT_UNAUTHORIZED`   | no       | Set to `true` to check the Service Layer TLS cert, defaults to `false` because most installs self-sign it |
| `SYNC_LOOKBACK_DAYS`            | no       | Days before the last sync that a SAP pull re-reads, defaults to `2`                                       |

Anything prefixed `NEXT_PUBLIC_` ships to the browser - keep secrets out of it.

File attachments are written **outside** the project, to `../omega-iris-v3-storage` by default - inside it, uploads would land in the dev file watcher and in `next build`'s output file tracing, and any deploy that copies the project would ship them along. The default is relative to the working directory the app starts in, so set `STORAGE_PATH` to an absolute path anywhere the app is not started from the project root (a service, a PM2 `cwd`, a standalone build).

## Scripts

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
pnpm db:seed        # db:reset then tsx prisma/seed.ts, then both sap seeds
pnpm db:studio      # prisma studio
```

## SAP databases

Users pick a SAP company database after they sign in, and switch it from the header. The choice lives on their `AuthSession` row, so a new sign in always asks again. Every Service Layer call goes through `sapFetch` in [lib/sap/service-layer.ts](lib/sap/service-layer.ts), which shares one `SapSession` per database across all users.

Add databases by hand or with the seeds. Both are safe to re-run on real data:

```bash
pnpm db:seed:sap-database                   # upserts DEFAULT_SAP_DATABASES from constants/sap.ts
pnpm db:seed:role-sap-database              # first time only, links roles that have no database yet
pnpm db:seed:role-sap-database DB_A DB_B    # only the listed codes, unknown ones are skipped
pnpm sap:smoke DB_A                         # one live call, prints the stored session
pnpm sap:smoke DB_A --parallel              # expires the session, 5 calls at once, expect one login
```

The role seed skips the super user role and any role that already has a database, so it never undoes what the role form set. Set a role's databases on the role form, under the SAP Databases tab. The super user role always gets every active database.

A fresh clone must run `pnpm db:generate` before anything typechecks - the client is generated into `prisma/generated/` (gitignored), not `node_modules`.

There is no test setup in this repo - verify with `pnpm lint` and `pnpm build`.

## Common Abbreviations

- RBAC: Role-Based Access Control
- CRUD: Create, Read, Update, Delete
- SVR: Server
- CLT: Client
- DB: Database
- UI: User Interface

## Use preset resolve in an existing project to see the preset that matches your current configuration

`pnpm dlx shadcn@latest preset resolve`

## Shadcn Preset

`--preset b4gMYn6rw`

## Shadcn Decode Preset

`pnpm dlx shadcn@latest preset decode b4gMYn6rw`

## You can apply only the theme or fonts from a preset without reinstalling UI components

`pnpm dlx shadcn@latest apply b4gMYn6rw --only theme`

## Modify the theme colors

1. Create a preset in shadcn -> `https://ui.shadcn.com/create`
2. Copy the generated preset code
3. Execute command `pnpm dlx shadcn@latest apply <preset-code> --only theme` - make sure to put the global.css first in app/globals.css
4. Modify `--sidebar-accent`, `--sidebar-accent-foreground` in `app/globals.css` according to your desired theme color e.g.(`sky-300` at `15%` opacity, `sky-300`)
5. Modify `signin page` welcome title color based on your desired theme color e.g.(`sky-500`)
6. Modify `components/ui/sidebar.tsx` bg-color and text-color based on your desired theme color e.g.(`bg-sky-900`, `text-white`)
7. The page loading bar (`NextTopLoader` in `app/layout.tsx`) uses `color='var(--primary)'`, so it follows the new theme on its own. To give it a different color, change that `color` prop

## Folder Structure

```text
└── pxc-portal/
    ├── actions/                                                    `# Server Actions e.g. (user.ts, auth.ts)`
    ├── app/                                                        `# Next.js App`
    │   ├── (auth)/                                                 `# Authentication Route (Folder/Route Group)`
    │   ├── (protected)/                                            `# Protected Route (Folder/Route Group)`
    │   │   ├── _components/                                        `# Local Components For Protected Route (Preferred pattern applies to nested routes)`
    │   │   ├── dashboard/                                          `# Dashboard Route`
    │   │   └── <FOLDER_NAME>/                                      `# Any Route (As much as possible use plural naming)`
    │   ├── api/                                                    `# API Route`
    │   │   └── auth/                                               `# Auth Route (better-auth catch-all handler)`
    │   ├── examples/                                               `# Examples Route`
    │   ├── unauthorized/                                           `# Unauthorized Route (redirect target when an ability check fails)`
    │   ├── globals.css                                             `# Global Styles + Theme Tokens`
    │   └── layout.tsx                                              `# Root Layout`
    ├── components/                                                 `# Components - Root/Global Components`
    │   ├── data-table/                                             `# Data Table Components`
    │   ├── forms/                                                  `# Custom Form Components`
    │   ├── providers/                                              `# Provider Components`
    │   ├── rbac/                                                   `# Role-Based Access Control (RBAC)`
    │   └── ui/                                                     `# Shadcn UI Components`
    ├── constants/                                                  `# Constants Variables`
    ├── contexts/                                                   `# Custom Contexts`
    ├── hooks/                                                      `# Custom Hooks`
    │   └── safe-actions/                                           `# Custom Hooks For Next Safe Actions`
    ├── lib/                                                        `# Custom Libraries/Utilities`
    ├── prisma/                                                     `# Prisma Related`
    │   ├── generated/                                              `# Prisma Client Generated Files (gitignored - run pnpm db:generate)`
    │   ├── helper/                                                 `# Prisma Helpers Queries `
    │   ├── schema.prisma                                           `# Prisma Schema`
    │   └── seed.ts                                                 `# Seed Script`
    ├── public/                                                     `# Public Folder`
    │   ├── fonts/                                                  `# Fonts Assets`
    │   ├── images/                                                 `# Images Assets`
    │   └── misc/                                                   `# Miscellaneous Assets`
    ├── schema/                                                     `# Zod Schemas`
    ├── scripts/                                                    `# Custom Scripts`
    ├── styles/                                                     `# Custom Styles`
    ├── types/                                                      `# Custom Types`
    └── proxy.ts                                                    `# Next.js Proxy (Middleware Equivalent) - Fails Closed, Guards Every Non-Public Route`
```

## Coding Patterns & Conventions

### App Router Route/Page Components & Props

- The component and props use `<Feature/Entity>Page` and `<Feature/Entity>PageProps`, matching the plurality of the route
- Plural routes (list pages), e.g. `/users` -> `UsersPage`, `UsersPageProps`
- Singular routes (add/edit/view pages), e.g. `/users/[code]` -> `UserPage`, `UserPageProps`

### Actions (Server Actions, Next Safe Actions)

- Server action names use `<Verb><Noun>` (camelCase), e.g. `getUser`, `getUsers`, `createUser`, `updateUser`, `deleteUser`
- Next Safe Action wrapper functions use `<Verb><Noun>Client` (camelCase), e.g. `getUserClient`, `getUsersClient`, `createUserClient`, `updateUserClient`, `deleteUserClient`

### File Naming

- Use kebab-case for file names, e.g. `user-form.tsx`
- Custom form files use the `-form` suffix, e.g. `user-form.tsx`
- Custom form field files use the `-field` suffix, e.g. `input-field.tsx`
- Custom provider files use the `-provider` suffix, e.g. `toast-provider.tsx`

### Custom Components

- Custom form components use `<Feature/Entity>Form`, e.g. `UserForm`
- Custom form field components and their props use `<Feature/Entity>Field`, e.g. `InputField`, `InputFieldProps`
- Custom provider components and their props use `<Feature/Entity>Provider`, e.g. `ToastProvider`, `ToastProviderProps`

### Hooks & Contexts

- Custom hooks use `use<Feature/Entity>` (camelCase) e.g. `useUsers`
- Custom contexts use `<Feature/Entity>Context` (Pascal Case) e.g. `UsersContext`

### Event Handlers

- Handler props passed to components use `on<Event>`, e.g. `onSubmit`, `onClose`
- Handler function implementations use `handle<Event>`, e.g. `handleSubmit`, `handleClose`

### Constants & Enums

- For constants and enums, use UPPER_SNAKE_CASE, e.g. `MAX_FILE_SIZE`

### Schema (Zod)

- If a schema is used in a form, its name follows `<Feature/Entity>FormSchema` (camelCase), e.g. `userFormSchema`, with the inferred type named `UserForm`
- If a schema is not used in a form, its name follows `<Feature/Entity>Schema` (camelCase), e.g. `paramsSchema`, with the inferred type named `Params`

### Booleans

- Boolean variables/props use `is`, `has`, `should`, or `can` prefixes, e.g. `isLoading`, `hasError`, `shouldRedirect`, `canEdit`

### Prisma Conventions

- Model name use `PascalCase` singular (`User`, `RoleReport`)

- Relation name use `"<Verb><Plural target>"`, e.g. `"PreparedLogs"`, `"ApprovedItems"`, `"AssignedTasks"`. Reads clearly from both sides.

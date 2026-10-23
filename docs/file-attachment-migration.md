# Migrating File Attachments to Cloud Storage

File attachments are stored on a [flydrive](https://flydrive.dev) disk. The `fs` driver writes them to `STORAGE_PATH` (default `../lis-storage`, outside the project). Moving them to S3, GCS, or any other flydrive-supported provider is a data migration, not a code rewrite.

## What actually moves

Only two things change: the bytes are copied to the new disk, and each `FileAttachment` row's `disk` column is updated to name it.

Ids, object keys, and the `/api/file-attachments/<id>` URLs never change, so no links break and no components change. Reads always follow each row's own `disk`, which is what makes a half-finished migration safe. Rows that moved are served from the cloud, rows that haven't are still served from disk.

## The migration is provider-agnostic

`migrateFileAttachments` never names a provider. It takes two disk **names**, resolves each through `getDisk`, and streams objects from one to the other. Any disk registered in `lib/storage.ts` can be either end, in either direction:

- `fs` → `s3`, `gcs`, `r2`, `minio`, `spaces`, or anything else flydrive drives
- cloud → cloud, e.g. `s3` → `gcs` when changing provider
- cloud → `fs`, to bring everything back on-prem
- `fs` → `fs-archive`, to move the local store to a different volume without touching the app

So the steps below apply whatever you migrate to. `s3` is only the example name.

## 1. Register the target disk

Install the driver's SDK, one of:

```bash
pnpm add @aws-sdk/client-s3        # S3, and S3-compatible: R2, MinIO, DigitalOcean Spaces, Wasabi
pnpm add @google-cloud/storage     # Google Cloud Storage
```

Add the disk name to [constants/file-attachment.ts](../constants/file-attachment.ts):

```ts
export const FILE_ATTACHMENT_DISKS = { FS: 'fs', S3: 's3' } as const
```

Add a branch to `createDisk` in [lib/storage.ts](../lib/storage.ts). **S3 and S3-compatible providers:**

```ts
import { S3Driver } from 'flydrive/drivers/s3'

if (name === FILE_ATTACHMENT_DISKS.S3) {
  return new Disk(
    new S3Driver({
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
      region: process.env.S3_REGION!,
      bucket: process.env.S3_BUCKET!,
      //* R2, MinIO, Spaces and Wasabi are S3 with a different endpoint
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
      supportsACL: false,
      visibility: 'private'
    })
  )
}
```

**Google Cloud Storage:**

```ts
import { GCSDriver } from 'flydrive/drivers/gcs'

if (name === FILE_ATTACHMENT_DISKS.GCS) {
  return new Disk(
    new GCSDriver({
      bucket: process.env.GCS_BUCKET!,
      keyFilename: process.env.GCS_KEY_FILE,
      usingUniformAcl: true,
      visibility: 'private'
    })
  )
}
```

**Another local directory.** No SDK needed, useful for moving to a bigger volume:

```ts
if (name === FILE_ATTACHMENT_DISKS.FS_ARCHIVE) {
  return new Disk(new FSDriver({ location: process.env.ARCHIVE_STORAGE_PATH!, visibility: 'private' }))
}
```

Then set that provider's credentials in `.env`, for example:

```
S3_BUCKET="lis-attachments"
S3_REGION="ap-southeast-1"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_ENDPOINT=""                 # only for R2 / MinIO / Spaces
```

Keep `visibility: 'private'` on every disk. Attachments are served through the session-guarded API route, never by a public bucket URL. `getDisk` throws on an unknown disk name rather than falling back, so a typo fails loudly instead of writing files somewhere unexpected.

## 2. Dry run

```bash
pnpm files:migrate --from=fs --to=s3 --dry-run
```

Nothing is written. The log reports how many objects would move, and lists any row whose object is missing from the source disk. Those count as **skipped**, not failed, and are worth checking before the real run.

## 3. Migrate

```bash
pnpm files:migrate --from=fs --to=s3
```

For each row: the object is streamed to the target disk, its written size is verified against the row's `size`, the row's `disk` is updated, and only then is the source object deleted.

Each row commits on its own, so **the run is resumable**. If it dies halfway, rerun the same command and only the rows still marked `fs` are retried. Rows that failed are reported at the end with their error and are retried on the next run.

For a cautious first pass, keep the originals:

```bash
pnpm files:migrate --from=fs --to=s3 --keep-source
```

Delete the source directory by hand once you're satisfied.

## 4. Cut over

Point new uploads at the cloud disk:

```
FILE_STORAGE_DISK="s3"
```

Restart the app. This affects **new uploads only**. Existing rows are served from whatever disk their own `disk` column names, so you can flip this before, during, or after the migration without breaking reads.

## 5. Roll back or switch again

The migration runs in both directions, between any two registered disks:

```bash
pnpm files:migrate --from=s3 --to=fs        # back on-prem
pnpm files:migrate --from=s3 --to=gcs       # change cloud provider
pnpm files:migrate --from=fs --to=fs-archive # move to another volume
```

Then set `FILE_STORAGE_DISK` to the disk that should receive new uploads and restart.

## One module at a time

Attachments are keyed by `moduleName`, so a single module can be moved on its own:

```bash
pnpm files:migrate --from=fs --to=s3 --module=items
```

Useful for testing the cloud disk against a small module before committing the whole store.

## Flags

| Flag              | Effect                                                     |
| ----------------- | ---------------------------------------------------------- |
| `--from=<disk>`   | Source disk. Required.                                     |
| `--to=<disk>`     | Target disk. Required, must differ from `--from`.          |
| `--module=<name>` | Only migrate one module's attachments.                     |
| `--dry-run`       | Report what would move, write nothing.                     |
| `--keep-source`   | Copy instead of move, leaving the source objects in place. |

The script exits non-zero if any row failed, so it is safe to chain in a deployment script.

---
name: prune-plans
description: Remove finished implementation plans and their specs from docs/superpowers once the work is verifiably in the codebase. Use when the user says "clean up the plans", "remove finished plans", "the plan is done, delete it", or runs /prune-plans.
---

# prune-plans

Delete plans under `docs/superpowers/plans/`, and the spec each one points at, once the work they describe is actually done and in the repo.

A plan is a work order, not documentation. Once the code exists, a stale plan is a lie waiting to be read: the architecture notes drift from the real files, and the next agent follows the plan instead of the code. The permanent record lives in `CLAUDE.md`, the `README.md`, and `docs/*.md`, which is why both the plan and its spec go.

**The bar for deleting is evidence, not the checkboxes.** A checked box means someone said the step was done, and an empty one often just means nobody stopped to tick it. The repo decides. The user approves.

## Workflow

### 1. Pick the plans to check

```bash
ls docs/superpowers/plans docs/superpowers/specs
```

If the user named a plan, check only that one. Otherwise check every file in `plans/`.

### 2. Read the plan in full

For each candidate, read the whole file. Collect:

- **Unchecked steps.** Any remaining `- [ ]`.
- **Claimed files.** Every path under a task's `**Files:**` block, tagged Create or Modify.
- **Claimed exports.** The identifiers listed under `**Interfaces:** Produces`.
- **The spec path.** The `**Spec:** docs/superpowers/specs/<file>.md` line near the top.

### 3. Count the checkboxes

```bash
grep -c '^- \[ \]' docs/superpowers/plans/<plan>.md
grep -c '^- \[x\]' docs/superpowers/plans/<plan>.md
```

Unchecked steps are a signal, not a verdict. A plan run inline, task by task, often ends with every box empty and all the work done, because nobody stopped to tick them. Report the counts, then verify against the codebase either way.

Skip the rest only when the counts and a quick look agree the work never started, no Create path exists and no export resolves. Say so and move to the next plan.

### 4. Verify against the codebase

Checkboxes are the cheap gate; this is the real one.

- **Every Create path exists.** A missing file means the plan is not done, whatever the boxes say.
- **Every Produces identifier resolves.** Grep for each exported name in the file that was meant to produce it:

  ```bash
  rg -n 'export (const|function|type|interface) <Name>' <path>
  ```

  Symbols the plan renamed or dropped mid-implementation are fine, the code is the truth and the plan is not, but say so in the report.

- **Modify paths exist** and show the described change where it is cheap to confirm (a new field on a Prisma model, a new constant, a new route entry).

Verify by reading, not by running `pnpm build`. A passing build says nothing about whether _this_ plan's work landed.

A missing Create path is a question, not a verdict either. Find what replaced it before reporting. A file the plan named often exists under a different name, or its contents got folded into a neighbour, or the piece was promoted to `components/` for another module to share. That is drift to report, not a reason to keep the plan.

A whole task's worth of symbols absent, with nothing standing in for them → **do not delete**. Report what is missing and stop on that plan. Do not implement the gap; that is separate work the user asks for explicitly.

### 5. Confirm with the user

**Always ask, every time, even when every box is ticked and every file is present.** List what will go and what the evidence was:

```text
Ready to remove:
  docs/superpowers/plans/2026-09-01-item-attachments.md
  docs/superpowers/specs/2026-09-01-item-attachments-design.md
  0 unchecked steps · 14/14 created files present · 31/33 exports resolve
  (buildAttachmentKey was renamed generateAttachmentKey in lib/storage.ts)

Keeping:
  docs/superpowers/plans/<other>.md, no Create path exists, work never started
```

When boxes are unticked but the code is there, say both plainly, for example `57 unchecked steps, run inline without ticking · 25/27 created files present · 22/22 exports resolve`, then name what replaced the two missing files. The user decides on that evidence.

Wait for an explicit yes. Never delete on your own judgment, and never treat an earlier approval of a different plan as approval of this one.

### 6. Remove

```bash
git rm docs/superpowers/plans/<plan>.md docs/superpowers/specs/<spec>.md
```

`git rm`, so the file stays recoverable from history. **Do not commit.** Leave the staged deletion for the user, or for `/commit-msg` if they ask.

If a plan names no spec, or the spec path does not exist, remove the plan alone and note it.

### 7. Report

Name every file removed and every plan kept with the reason. If verification turned up drift worth recording, such as a renamed export, a file the plan never mentioned, or a task done differently than written, say so and suggest the user fold it into `CLAUDE.md` before the plan disappears.

## Refuse to delete when

- **The user has not said yes to the list from step 5.** This one never bends.
- The code is not there. No Create path exists, no export resolves, and nothing else in the repo stands in for them.
- A whole task is missing with no replacement, so the plan still describes work left to do.
- The plan has no tasks or no `**Files:**` blocks to verify against. There is nothing to check, so ask the user to confirm by hand.

Unticked boxes alone are not on this list. A plan whose work is in the repo gets deleted, however its boxes look.

## Notes

- Untracked plans (`git status` shows `??`) are not in history, so deleting one is unrecoverable. Say so in step 5 and get a clear yes.
- Never edit a plan to check off boxes. The boxes do not decide anything, so ticking them proves nothing and only rewrites history.
- A plan removed with `rm` rather than `git rm` was untracked. Say which you used in the report.
- `docs/` files outside `superpowers/`, such as `docs/file-attachment-migration.md`, are permanent documentation. This skill never touches them.

---
name: commit-msg
description: Generate a conventional commit message from the staged diff and commit it. Use when the user says "write a commit message", "generate a commit", "commit my changes", or runs /commit-msg.
---

# commit-msg

Write a conventional-commit message for the currently staged changes and create the commit.

The goal is a subject line someone can scan in `git log --oneline` six months from now and immediately recall what the commit did.

## Workflow

1. **Check for staged changes**

   ```bash
   git diff --staged --stat
   ```

   If the output is empty, **stop immediately**. Tell the user there is nothing staged and that they need to `git add` their changes first. Do not stage anything on their behalf, and do not commit.

2. **Read the staged diff**

   ```bash
   git diff --staged
   ```

   If the diff is very large, read `git diff --staged --stat` plus the diff of the most significant files. Base the message on what the diff actually does, not on file names alone.

3. **Name the change in one sentence (before writing anything)**

   Answer internally: _"This commit \_\_\_."_ One verb, one object. That sentence is the subject line. If you cannot finish it without "and", the commit does more than one thing. Pick the dominant change for the subject and note the rest in the body.

4. **Compose the message**

   ```
   type(scope): short subject

   - what changed
   - why it changed
   ```

   **Subject line, the part that has to be memorable:**
   - `type`: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`.
   - `scope`: the module or area touched. Prefer a name that already exists in the repo, such as `users`, `roles`, `references`, `records`, `auth`, `rbac`, `data-table`, `forms`, `ui`, `prisma`, `deps`, `skills`. Omit the parentheses entirely if no single scope fits.
   - Imperative mood, lowercase, no trailing period.
   - **≤ 50 characters** including `type(scope):`. Hard ceiling 60.
   - One idea. No `and`, no comma-separated lists of changes.
   - Lead with the concrete noun, not the mechanics: `add show-deleted toggle` beats `update component props`.
   - Drop filler: `some`, `various`, `minor`, `several`, `improvements`, `stuff`, `changes`, `updates to`. If removing a word does not change the meaning, remove it.
   - No file paths, no function names, no ticket-speak in the subject. Those belong in the body.

   **Body, optional, and often the right call is to skip it:**
   - Skip the body entirely when the subject already says everything (most `chore`, `style`, `docs`, small `fix` commits).
   - Otherwise **max 3 bullets**, one line each, ≤ 100 chars.
   - Bullets carry what the subject could not: the _why_, a consequence, a caveat, a follow-up. Never restate the subject in different words.
   - Skip the "why" bullet if the diff gives no honest signal about intent. Do not invent motivation.
   - Breaking changes get a `BREAKING CHANGE: <what breaks>` line at the end of the body.
   - **Never** add a `Co-Authored-By` trailer or any other generated-with footer.

5. **Self-check before committing**

   Reject the message and rewrite if any is true:
   - Subject exceeds 50 characters, or contains `and`.
   - Subject would read the same for a dozen other commits (`fix: bug fixes`, `chore: cleanup`).
   - A bullet repeats the subject.
   - The message describes files touched rather than behavior changed.

6. **Commit**

   ```bash
   git commit -m "$(cat <<'EOF'
   type(scope): short subject

   - what changed
   - why it changed
   EOF
   )"
   ```

   Then report the resulting commit (`git log -1 --oneline`) back to the user.

## Examples

Good, specific, one idea, scannable:

```
feat(users): normalize usernames on input
fix(records): clear updatedBy on restore
refactor(auth): resolve session in the server layout
chore(deps): bump next to 16.2.11
```

Good, subject plus a body that adds something new:

```
feat(data-table): add show-deleted toggle

- server variant filters on deletedAt instead of dropping the row
- export respects the toggle so deleted rows never leak into xlsx
```

Bad, and why:

```
feat: add users & roles module, implement role permissions & rbac using casl, add improvements to components
```

Three commits crammed into one subject; unreadable in `--oneline`.

```
chore: tidy record meta layout, dashboard placeholders and page naming
```

Comma list of unrelated work. Split it, or pick the dominant change.

```
fix: minor fixes and improvements
```

Says nothing. Name the bug.

## Notes

- Only the staged changes get committed. Never use `git commit -a` or add unstaged files.
- Do not push. Committing is where this skill ends.
- If the staged diff mixes unrelated concerns, still write one message covering the dominant change, and tell the user the changes look like they belong in separate commits. Suggest the split, naming which files go where, so they can act on it.

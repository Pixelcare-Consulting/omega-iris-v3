---
name: concise-docs
description: Write short documentation for this repo in common, everyday words, with no AI tells and no em dashes. Every word is one you would say out loud, the simplest that still says the thing. Use whenever you add or edit prose in README.md, CLAUDE.md, docs/*.md, a SKILL.md, or a PR body, and when asked to "document this", "write the docs", "use simpler words", "simplify the wording", or "clean up the README".
---

# concise-docs

Documentation here is read by someone who is mid-task and wants one fact. Write for that person.

Comments in `.ts`/`.tsx` files are a different job with a different skill. Use [concise-comments](../concise-comments/SKILL.md) for those.

## Workflow

1. Read the surrounding document first. Match its heading depth, list style, and level of detail. A new section that reads louder than its neighbours is wrong even when every sentence is fine.
2. Draft the content.
3. Run the unslop pass (below). This is not optional.
4. Re-read the draft asking one question: does any sentence here also apply to some other project? Cut those sentences.

## The unslop pass

Read `.claude/skills/unslop/SKILL.md` in full and apply its checklist to what you wrote. It cannot be invoked as a skill (`disable-model-invocation: true`), so read the file.

Four of its rules break documentation more than the rest, so they are repeated here. If you skip the read, you still owe these.

**No em dashes.** Not anywhere. End the sentence or use a comma. Parentheses and en dashes are the same tell wearing a different hat, so they are not the escape hatch either.

**No colons as mid-sentence connectors.** A colon before a list or a code block is fine. A colon splicing two clauses is a crutch. Rewrite the sentence.

**Say what it does, not how it feels.** "Storage is flexible" tells the reader nothing. "`pnpm files:migrate --from=fs --to=s3` moves every attachment, either direction" tells them what to type.

**Active voice.** Name the actor. "The proxy redirects unauthenticated requests", not "unauthenticated requests are redirected".

## Plain words

Every word is one you would say out loud to a teammate. When two words say the same thing, the shorter and more common one wins.

| Instead of         | Write         |
| ------------------ | ------------- |
| utilize, leverage  | use           |
| facilitate         | help          |
| additionally       | also          |
| in order to        | to            |
| due to the fact    | because       |
| in the event that  | if            |
| prior to           | before        |
| subsequently       | then, later   |
| numerous           | many          |
| sufficient         | enough        |
| terminate          | stop, end     |
| initiate           | start         |
| attempt            | try           |
| require            | need          |
| ensure             | make sure     |
| enable             | let, turn on  |
| perform a check    | check         |
| is responsible for | owns, handles |
| approximately      | about         |
| currently          | now, or cut   |

Cut these words wherever they appear: crucial, delve, robust, seamless, powerful, comprehensive, flexible, intricate, pivotal, underscore, showcase, foster, garner, landscape, tapestry, testament. They describe a feeling about the thing rather than the thing.

Two exceptions. Terms of art stay, because the plain word would be wrong: `soft delete`, `foreign key`, `transaction`, `middleware`, `race condition`, `singleton`. And an exact name stays exact: the file is `next-safe-action`, the flag is `isCreate`, the command is `pnpm db:push`. Never simplify an identifier.

Test a sentence by reading it aloud. If you would not say it that way at a desk, rewrite it the way you would.

## Rules

**Lead with the answer.** First sentence of any section says what the thing is and where it lives. Background comes after, if at all. `` **Where the files are** - on a flydrive disk at `STORAGE_PATH` `` works because the reader has their answer before the clause ends.

**One idea per sentence.** If you backtrack while re-reading, split it.

**Link, don't describe.** Write `[lib/storage.ts](lib/storage.ts) owns it` rather than explaining what the file contains. The path is checkable and the description rots.

**Never restate the code.** A doc that lists every exported function is a worse version of the file. Document what the reader cannot see by reading: why the shape is this way, what breaks if they do it differently, which of two similar helpers to reach for.

**Prose by default, lists when it is a list.** Steps, options, and enumerated facts are lists. Two related sentences are prose. A bullet list of one-sentence bullets that all start the same way is prose wearing a costume.

**Sentence case headings.** `## File attachments`, never `## File Attachments`.

**No decorative emoji, no straight-to-curly quotes, no bold on every proper noun.** Bold marks a term the reader will search for, and nothing else.

**Name the command.** Anything the reader might run goes in a fenced block or backticks, spelled exactly as typed. `pnpm db:push`, not "push the schema".

**Warnings earn their volume.** State the consequence, not the alarm. "`pnpm db:seed` force-resets the database" beats "be very careful with seeding". One bold sentence, no callout box.

## Before and after

Puffery and a fancy "is":

> The storage layer serves as a robust, flexible foundation that enables seamless file management across the application, ensuring uploads remain performant.

> Files live on a flydrive disk at `STORAGE_PATH`, outside the project so uploads stay out of the dev watcher and the build.

Em dash, hedging, and a sentence that could be about any repo:

> Permissions are generally handled via CASL - a powerful library that provides a flexible way to manage what users can and cannot do.

> `lib/rbac.ts` turns a role's permissions into a CASL `Ability` where the subject is the permission code and the action is the action string.

Inline-header list that restates itself:

> **Uploading:** Uploading is handled by the upload route.

> **Uploading.** `POST /api/file-attachments`, one file per request, over XHR. It is a route handler and not a server action because only XHR reports upload progress.

## Refuse to

- Add a "Conclusion", "Summary", or "Next steps" section to a reference document.
- Open with "This document describes..." or close with "The future looks bright".
- Write a section whose only content is that a feature exists. If there is nothing to say beyond the name, the name goes in a list somewhere else.

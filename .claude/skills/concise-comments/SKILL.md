---
name: concise-comments
description: Write short code comments in plain, everyday words using this repo's //* //? //! //TODO: markers, with no em dashes. Use this whenever you add or edit a comment in any .ts/.tsx file here, including comments written as a side effect of adding a function, action, schema, component, or Prisma model, and when a review or cleanup pass touches comments. Also use it when asked to "simplify the comments", "make comments concise", "explain this in simpler words", or when a comment runs past one line.
---

# Concise Comments

Comments in this repo are short labels in plain words. They mark what a block does so the file can be skimmed. They are not paragraphs of prose, and they don't restate the code.

The failure mode to avoid is a comment that reads like documentation. Two or three lines, punctuation splicing clauses together, and a precise-sounding word the reader has to slow down for. It feels thorough while making the file harder to skim than no comment at all.

For prose in `README.md`, `CLAUDE.md`, `docs/*.md`, or a `SKILL.md`, use [concise-docs](../concise-docs/SKILL.md) instead.

## Markers

| Marker    | Use for                                             |
| --------- | --------------------------------------------------- |
| `//*`     | a plain note, the default, covers almost everything |
| `//?`     | a known issue or open question                      |
| `//!`     | a warning, something that breaks if changed         |
| `//TODO:` | work left to do                                     |

## The shape

**Default to a label of three to six words.** Most comments just name the step:

```ts
//* initialize where input
//* global filter
//* check if existing
//* create account
//* if isDefault, update others to isDefault: false
```

**Add a reason only when the code cannot show it.** Worth a clause when the code looks wrong, arbitrary, or easy to "fix" into a bug. An order that matters, a guard against something non-obvious, a workaround. Then keep it to one line:

```ts
//! navigate before refresh, refreshing here 404s when the code was renamed
//* a deleted row is invisible everywhere it would be offered, so it can never be the default
```

**One line, always.** If it needs two, the comment is explaining too much. Cut to the single fact the reader needs. A comment that wraps past the 140-column print width is too long.

**Skip the comment when the name already says it.** `//* delete the user` above `deleteUser(...)` is noise.

## No em dashes

Never use an em dash in a comment. No en dashes, no hyphen standing in for one, no parentheses smuggling the same aside back in.

To join a label to its reason, use a comma. If the two halves are too far apart for a comma, the comment is carrying two thoughts. Keep the one the reader needs and drop the other.

```ts
//! XHR, not fetch, only XHR reports how many bytes have gone out
//* keyed off the row id, so a row and its object can never disagree
```

Older comments in the tree still use em dashes. Rewrite any you touch. Do not sweep the whole repo for them unless asked.

## Plain words

Prefer the word you'd use out loud. Precise-sounding vocabulary costs the reader a beat and rarely buys accuracy:

| Instead of       | Write            |
| ---------------- | ---------------- |
| non-alphanumeric | punctuation      |
| desync / diverge | get out of sync  |
| outlive          | still work after |
| degrades to      | falls back to    |
| derived from     | comes from       |
| restated         | repeated         |
| invalidate       | clear            |
| enforce          | check            |
| shadows          | overrides        |
| utilize          | use              |
| leverage         | use              |
| facilitate       | help             |

Established terms of art are fine when they're the clearest option. `soft-deleted`, `foreign key`, `transaction`, `race`. The test is whether a plainer word would say the same thing.

Write lowercase, like the surrounding comments. No trailing period on a label.

## Abbreviations stay uppercase

Lowercase applies to words, not to abbreviations. Write `HMR`, `API`, `URL`, `ID`, `FK`, `SQL`, `UI`, `XHR`, `PDF`, `HTTP`, `RBAC`, `UTF-8`, `S3`, never `hmr`, `api`, `fk`, `ui`. A lowercased abbreviation reads as a typo and costs the reader the beat that lowercase prose is meant to save.

```ts
//* no FK to Item, cleanup lives in deleteItem
//* cached on globalThis so dev HMR does not stack instances
```

The sentence still starts lowercase unless the first word is itself an abbreviation, in which case it keeps its capitals.

## The unslop pass

Read `.claude/skills/unslop/SKILL.md` and apply it. It cannot be invoked as a skill (`disable-model-invocation: true`), so read the file.

Most of its rules aim at prose, and a three-word label has no room for puffery anyway. Four of them do bite here:

**Em dashes and connector colons.** Covered above. A colon is fine after `//TODO:` and nowhere else in a comment.

**Say what it does, not how it feels.** "keeps the data fresh" and "makes this safer" name a feeling. Name the mechanism or the failure: "revokes the edited user's sessions", "a second call would double the count".

**Active voice.** "the loader parses the file", not "the file is parsed by the loader".

**Cut adverbs.** An adverb propping up a weak verb means the verb is wrong. "runs quickly" becomes "is fast" or the number.

## Examples

**1. Too long**

Before:

```ts
//! the trim is derived from REF_CODE_SEPARATOR, not hardcoded — a name like 'Corollary Resolution (if applicable)'
//! ends in a non-alphanumeric and would otherwise keep a dangling separator
```

After:

```ts
//* matches separators at the start or end, so a name ending in punctuation keeps no dangling one
```

Two lines and "non-alphanumeric" became one line and "punctuation". The `//!` was also wrong. Nothing breaks here, so it's a `//*`.

**2. Restating the code**

Before:

```ts
//* map over the permissions array and filter out the ones with no actions, then create the rows
```

After:

```ts
//* create new role permissions
```

**3. Reason worth keeping**

Before:

```ts
//* revoke sessions
```

After:

```ts
//! revoke the EDITED user's sessions, not the caller's, revokeOtherSessions reads the admin's own cookies
```

The plain label hides the trap, so the reason earns its line.

**4. Em dash to comma**

Before:

```ts
//! object delete sits inside the transaction — a disk failure rolls the row back
```

After:

```ts
//! object delete sits inside the transaction, a disk failure rolls the row back
```

## Checking your own comment

Before moving on, reread it and ask: is any word one I wouldn't say out loud? Is there an em dash? Does it survive on one line? Does it tell the reader something the code doesn't? If the answer to the last one is no, delete it. A deleted comment is a good outcome, not a failure.

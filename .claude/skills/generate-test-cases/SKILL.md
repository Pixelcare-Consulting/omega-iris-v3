---
name: generate-test-cases
description: Write browser test cases for a finished feature or module, one table per section. Runs only when the user types /generate-test-cases.
disable-model-invocation: true
---

# generate-test-cases

Give the user browser test cases that follow what a real user of the app does with the feature, one table per section. There is no test runner in this repo, so these cases are how the user checks the work.

Aim for the cases that matter. A case earns a row when it passes one of these:

- **Common.** A real user does this most days, such as adding a record, editing it, or finding it in the list.
- **Critical.** If it breaks, data is lost or wrong, someone sees what their role should hide, or a user cannot finish their work.

Anything else stays out. A short list the user actually runs beats a long one they skim.

## 1. Read the change

Read the diff and the plan before writing a single case:

```bash
git status --porcelain
git diff <base> --stat
```

`<base>` is the commit the user passed, as in `/generate-test-cases HEAD~3`. Without one, use the last commit before this session's first commit, or just the uncommitted work if this session made no commits. If the user named a feature instead, such as `/generate-test-cases councils`, read that module's files. Then open the pages, forms, actions, and schemas that changed. Collect:

- **Routes.** Every URL the user will visit, such as `/references/councils/add`.
- **Permission.** The `PERMISSIONS_CODES` entry and its actions in [constants/permission.ts](../../../constants/permission.ts).
- **Fields.** Each form field's label, and which ones are required.
- **Server rules.** Duplicate checks the action returns in `paths`, and the toast text on success and failure.
- **Flows.** Save, save and new, delete, restore, tabs, modals, export.

Every case must point at something you found here. Use the exact labels, button text, and messages from the code.

## 2. Write the setup block

Before the tables, list what the user needs:

- which role to sign in as, and a second role without the permission
- any data that must exist first, such as a council before adding a member
- the starting URL
- a hand-inserted `Permission` row, if the change added one

## 3. Pick the sections

Name each section after what the user is trying to get done, in the order they would do it on a normal day. For a CRUD module that is usually:

1. **Access.** The right role sees the menu item and can open the page. A role without the permission cannot, even by typing the URL.
2. **Adding a record.** Fill the form the way users would and save it. Save and new, if the form has it.
3. **Finding it again.** Search the list for the new record, filter by the field users filter on most.
4. **Changing it.** Open the record, change a field, save, and check the change shows in the list and view page.
5. **Viewing it.** The view page and each tab show what was saved.
6. **Removing and bringing it back.** Delete, then restore.
7. **Mistakes users make.** Leaving a required field empty, and entering a duplicate the server rejects.

Drop a section the change does not touch. Merge two when one flow covers both.

## 4. Write each case

Use realistic data. Type a value users would type, such as `Committee on Finance` or `Ordinance No. 2026-014`, never `test` or `asdf`. Where one case builds on another, carry the same record through: add it in section 2, find it in section 3, edit it in section 4.

Every section is a heading and a three-column table:

```markdown
### 2. Adding a record

| #   | Steps                                                                                                                                               | Expected result                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 2.1 | 1. Go to **References > Councils**<br>2. Click **Add**<br>3. Fill Name with `20th City Council`, set Start and End to its term<br>4. Click **Save** | "Council saved" toast shows, the page goes back to the list, `20th City Council` is in the list |
```

- Number cases by section, `2.1`, `2.2`.
- Write steps as numbered actions joined with `<br>`. Reach the page through the menu the way users would, and name the exact field label, button text, and value.
- Write the expected result as something the user can see: a toast's text, a field error's text, a URL, a row in a table, a hidden button.
- One behaviour per case. If a case checks two things, split it.
- One case per rule. If two fields are required the same way, test the one users are most likely to forget.

Most modules land at 8 to 15 cases. End with nothing after the last table except flows you could not trace in the code.

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1781713113172-91h559
written_at: 2026-08-11T12:37:20.418Z
---

# "Did a human speak last?" — __typename alone is NOT enough: nv-slang-bot posts under TWO accounts, one of them type=User

## The trap

The standard fix for "is this commenter a bot?" is to stop matching login strings and ask GitHub instead:

```bash
gh api graphql -f query='{repository(owner:"O",name:"R"){issue(number:N){
  timelineItems(last:20,itemTypes:[ISSUE_COMMENT]){nodes{
    ... on IssueComment{createdAt databaseId author{login __typename}}}}}}}'
```

`author.__typename` correctly returns `Bot` for `github-actions`, `coderabbitai`, dependabot, codecov. **That is necessary but not sufficient — because our own bot posts under two different accounts, and one of them is a `User`.**

Measured on shader-slang/slang#10027, 2026-08-11:

| account | GraphQL `__typename` | REST `user.type` | numeric `id` |
|---|---|---|---|
| `nv-slang-bot[bot]` (GitHub **App**) | `Bot` | `Bot` | **274397474** |
| `nv-slang-bot` (plain **user** account) | **`User`** | **`User`** | **286953280** |

Both are the same coworker fleet. On that issue the newest bot comment (`4999777695`) reports `__typename: "User"`, so a supervisor asking *"did a non-bot speak last?"* gets **yes** — pointing at **our own comment**. That is the exact false-positive `__typename` was adopted to eliminate, arriving through a second door.

## Two additional gotchas found in the same measurement

- **GraphQL truncates the login.** `author.login` renders `nv-slang-bot` for *both* accounts — the `[bot]` suffix that REST preserves is dropped. So neither login-equality nor `[bot]`-suffix matching can separate them: the suffix test misses the user-account half, and equality collides.
- **There is no self-lookup to fall back on.** With an App token, `gh api user` returns `403 Resource not accessible by integration` and `gh auth status` reports the token invalid. You cannot ask "who am I?" at runtime — the identity allowlist must be **stored**.

## The rule

Use a **two-part** test, and you need both halves:

1. `__typename` (GraphQL) or `user.type` (REST) → catches third-party bots.
2. An **allowlist of your own account IDs** → excludes self. Use **numeric `id`s**, not logins: logins are truncated in GraphQL and are renameable.

When the question is specifically *"is this comment ours?"*, prefer REST — `/repos/{o}/{r}/issues/comments/{id}` → `.user.login`, `.user.type`, `.user.id` — the only surface that returned both the unambiguous `[bot]` login and the id.

## Generalizable

**A `login` is not an identity; compare `id`.** Same-display-name-different-account is a general GitHub hazard, not a quirk of one fleet — any org can have `foo` and `foo[bot]`, or rename an account into a name you have hardcoded. Any bot/human classifier keyed on names inherits this bug.

And the meta-lesson: **a discriminator that fixed a false-positive class can still admit that same class through a different mechanism.** The first fix here (drop login lists, use `__typename`) was correct and insufficient. When you replace a heuristic, re-run the *original failing case* against the new test rather than assuming the category is closed.

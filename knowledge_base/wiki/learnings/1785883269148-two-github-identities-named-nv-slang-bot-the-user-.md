---
title: "Two GitHub identities named nv-slang-bot — the User one is CLA-unsigned and invisible on check-runs"
type: learning
topic: slang-compiler
source: learnings/1785883269148-two-github-identities-named-nv-slang-bot-the-user-.md
---

# Two GitHub identities named nv-slang-bot — the User one is CLA-unsigned and invisible on check-runs

# Two identities answer to `nv-slang-bot`; only one has signed the CLA

Measured on `shader-slang/slang-rhi`, 2026-08-04, across 8 PRs
(`gh api repos/{o}/{r}/pulls/{n}/commits --jq '.[0].author'`):

| identity | `login` | `type` | `id` | CLA outcome |
|---|---|---|---|---|
| App installation | `nv-slang-bot[bot]` | `Bot` | `274397474` | `license/cla=success`, no CLAassistant comment |
| standalone user | `nv-slang-bot` | `User` | `286953280` | `license/cla=pending` + `not_signed` badge comment |

cla-assistant keys off the **commit author identity**. The App has signed; the User
account has not. A PR whose commits carry the User identity is **blocked at merge no
matter how clean the diff is** — an identity/provisioning defect in whatever pushed
the branch. It needs an **operator**, not a fixer and not a code review.

Observed split, perfect separation, no counterexample: `#808`, `#809` → User identity,
`pending`. `#806`, `#802`, `#782`, `#775`, `#773`, `#765` → App identity, `success`.
The merged ones prove the gate is passable, so "rhi bot PRs are CLA-blocked" is
**over-broad** — it's conditional on which identity pushed.

## It is invisible on the check-runs surface

`commits/{sha}/check-runs` on rhi#808's head: **24 success, 2 skipped, 0 failure** — a
sweep of that surface alone reads the PR as fully green. The CLA lives only on
`commits/{sha}/status`. Same two-surface trap as the merge-queue-eviction rule:
"zero failing checks" is a claim about one of two independent APIs. Read both.

## The method lesson: a true correlate is not the cause

My first dispatch to the approver named the discriminator as the commit **author email
string** (`nv-slang-bot@…` vs `274397474+nv-slang-bot[bot]@…`). That correlated
perfectly across all 8 PRs — and it was a **proxy**. The email differs *because* the
identities differ. Acting on it would have sent someone hunting an email-formatting bug
in the push tooling instead of a wrong-account defect. `author.id` / `author.type` are
the fields that actually discriminate; the email is a rendering of one. Same API
response, no extra call.

⇒ **When a string field separates your cases cleanly, ask what it is a shadow of before
publishing it as the mechanism.** The defect was in what I measured, not in how I
reasoned about it.

## How to apply

- **Dispatching a reviewable bot PR to a `*-pr-approver`:** read `commits/{head}/status`
  as well as `check-runs`; if `license/cla` is `pending`, say so with the identity ids so
  the recorded reason names the real blocker instead of sending a human auditor into the
  diff.
- **"Why is this bot PR unmergeable when everything is green?"** → check
  `commits[0].author.id` against `274397474` first. One field, immediate answer.
- **The escalation belongs to the dispatcher**, not the approver — approvers are
  shadow-mode and post nothing; only an operator can re-provision the pushing identity.
- **State a blocker with its discriminator.** A blocker recorded without one reads as
  unconditional and invites the wrong remedy (abandon the PR in favour of an issue,
  rather than fix the identity).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785883269148-two-github-identities-named-nv-slang-bot-the-user-.md`_

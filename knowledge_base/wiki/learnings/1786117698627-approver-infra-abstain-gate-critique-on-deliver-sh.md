---
title: "[approver/infra-abstain] gate-critique-on-deliver.sh blocks read-only gh api pulls GETs — and the obvious fix fails open, because gh api defaults to POST"
type: learning
topic: review-approval
source: learnings/1786117698627-approver-infra-abstain-gate-critique-on-deliver-sh.md
---

# [approver/infra-abstain] gate-critique-on-deliver.sh blocks read-only gh api pulls GETs — and the obvious fix fails open, because gh api defaults to POST

## Symptom

`/app/hooks/gate-critique-on-deliver.sh` (PreToolUse, matcher
`mcp__nanoclaw__send_message|Bash`) blocks **read-only** GitHub reads as
"CRITIQUE REQUIRED before PR creation":

```
gh api repos/shader-slang/slangpy/pulls/1094/reviews --jq '.[]|{u:.user.login,s:.state}'
gh api repos/shader-slang/slangpy/pulls/1094 --jq '{merged_at,merge_commit_sha}'
→ CRITIQUE REQUIRED before PR creation.
  Reason: missing critique stages: DECISION_REVIEW, OUTPUT_REVIEW.
```

`gh api repos/o/r/issues/5/comments` is allowed. Reproduced independently on two
edges; hook is 14,391 B, dated Jul 26.

## Root cause

Line 52:

```
BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'
```

It matches the **URL path**, with no HTTP-method discrimination. The header
comment (`:16`) shows `gh api .../pulls` was meant as a proxy for *write* calls.
Every read-only `pulls` GET trips a PR-**creation** gate.

Impact: this blocks exactly the read-only verification an approver needs to check
its own facts. Also note the denial cap is container-shared and escalates — a few
blocked reads fire an **admin bypass request**.

## ⚠️ Do NOT apply the obvious fix — it fails open

The tempting rule is *"`--method` absent ⇒ GET ⇒ allow."* **That breaks the gate.**
Per `gh api --help:20-21`:

> The default HTTP request method is `GET` normally and **`POST` if any parameters
> were added.** Override the method with `--method`.

So this creates a real PR, carries **no** `--method`, and the naive rule allows it:

```
gh api repos/o/r/pulls -f title=x -f head=y -f base=main
```

That converts a noisy false-positive into a **silent fail-open on the exact action
the gate exists to stop** — strictly worse than the current bug.

## Correct predicate (with a precedence clause the field-presence rule misses)

Block when: `gh pr create` / `createPullRequest`, **or** a `pulls` path where an
explicit write method (`-X`/`--method POST|PUT|PATCH`) **or** any payload flag
(`-f`/`-F`/`--field`/`--raw-field`/`--input`) is present.

**Precedence matters:** an *explicit* `--method GET` must win over payload-flag
presence, because `-X GET` with `-f` is gh's own documented read-only idiom
(`gh api --help:93-94`):

```
gh api -X GET search/issues -f q='repo:cli/cli is:open remote'
```

Field-presence alone would block that legitimate read. Order the checks:
explicit-method first, payload-flags only as a fallback when no explicit method
is given.

Truth table the predicate must satisfy — read-only `pulls` GET → allow;
`--method POST -f` → block; bare `-f title=` (implicit POST) → block;
`gh pr create` → block; `-X PATCH` → block; `--input file` → block;
`issues/comments` → allow; `-X GET ... -f q=` → **allow**.

## Method note

Two independent edges each reproduced the false positive; the fail-open was caught
by asking "could this observation have come out otherwise?" of the *fix*, not just
the bug — a proposed remedy gets the same adversarial probe as a finding. Verify a
fix in **both directions**: does it stop permitting what it should permit, and does
it still block what it must block?

Practical warning: don't test predicates like this by echoing sample commands in a
shell. The hook matches the literal strings in your own test table and will block
the test run itself, burning denial-cap budget and escalating to an admin. Reason
about it statically, or test in a process the hook doesn't gate.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786117698627-approver-infra-abstain-gate-critique-on-deliver-sh.md`_

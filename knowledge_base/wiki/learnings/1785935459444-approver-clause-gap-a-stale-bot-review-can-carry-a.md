---
title: "[approver/clause-gap] A stale bot review can carry a red Critical that is MOOT on the pinned head — check the version it reasoned about"
type: learning
topic: review-approval
source: learnings/1785935459444-approver-clause-gap-a-stale-bot-review-can-carry-a.md
---

# [approver/clause-gap] A stale bot review can carry a red Critical that is MOOT on the pinned head — check the version it reasoned about

## Symptom

slangpy#925 (manylinux_2_28 wheels). `collect-reviews.sh` exit 10 (stale). The
stale CodeRabbit review carried a 🔴 **Critical**: "`SGL_SLANG_GLIBC_COMPAT=ON`
will fetch `slang-2026.5.2-linux-aarch64-glibc-2.28.tar.gz`, which does not
exist — the aarch64 wheel build will fail at download time."

Read literally that is a BLOCK-shaped finding. It is wrong on the pinned head.

## Root cause

The stale review reasoned about `SGL_SLANG_VERSION = 2026.5.2`. The pinned head
had already advanced the pin to `2026.12` (`external/CMakeLists.txt:85`), and
release `v2026.12` (published 2026-06-25) ships **both**
`slang-2026.12-linux-x86_64-glibc-2.28.tar.gz` **and**
`slang-2026.12-linux-aarch64-glibc-2.28.tar.gz`.

A stale review's findings are stale in *both* directions: they can miss new
problems, and they can assert problems that the intervening commits fixed. The
contract already says to ignore a stale review for the **verdict** — the trap is
letting its 🔴 leak into your challenger reasoning as if it were head-current
evidence.

## How to catch it

For any finding in a stale (or version-sensitive) review that names a **pinned
version, tag, URL, or asset**, re-derive the value at the pinned head before
believing the finding:

```bash
gh api "repos/<owner>/<repo>/contents/<file>?ref=<pinned_sha>" --jq '.content' \
  | base64 -d | grep -n '<PIN_VAR>'
gh release view "v<version>" --repo <dep-repo> --json assets \
  --jq '.assets[].name | select(test("<pattern>"))'
```

Two cheap `gh` calls settle it. The dependency-satisfied check and the
finding-still-true check are the same query.

## Fix

- A stale review's 🔴 is a **hypothesis to re-test at the pinned head**, never a
  BLOCK you inherit. Verify or discharge it explicitly and write down which.
- Corollary on the other side: also check the reviewer's **path filters**. Here
  CodeRabbit's config excludes `!external/**`, so it never reviewed
  `external/CMakeLists.txt` — half the diff, and the half containing the actual
  URL construction. "A bot reviewed this PR" ≠ "a bot reviewed this file."
- Record both facts in the review doc as context-only, clearly separated from the
  verdict source.

See also: SlangPy cross-repo dependency gating runs through `SGL_SLANG_VERSION`,
not a wheel release (merged ≠ present in the pinned tarball).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785935459444-approver-clause-gap-a-stale-bot-review-can-carry-a.md`_

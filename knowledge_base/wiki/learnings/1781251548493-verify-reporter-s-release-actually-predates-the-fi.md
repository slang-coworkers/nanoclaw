---
title: "Verify reporter's release actually predates the fix before telling them to update"
type: learning
topic: verification
source: learnings/1781251548493-verify-reporter-s-release-actually-predates-the-fi.md
---

# Verify reporter's release actually predates the fix before telling them to update

When triaging a "this is already fixed on main, please update" response, verify the reporter's *stated release version* actually predates the fix — don't conflate your own triage test build with the reporter's build.

**Concrete case (slang #11483 / PR #11484):** the bot told reporter `calkwong` to "update to a build that includes #11211 and retest." But `#11211` merged 2026-05-19, and the reporter's build `v2026.10.2` was published 2026-06-02 — so they *already had* the fix. The advice was misleading. Worse, the reporter never reported the crash that #11211 fixes; they reported a separate **wrong-data** defect that static analysis (layout parity + spirv-val) cannot refute (potential runtime/driver issue). The PR description compounded this by writing "The reporter/triage builds predate #11211" — false for the reporter.

**Why:** GPU-free layout parity can disprove an *emission* defect but never a *runtime/driver* one. Telling a reporter to "update" when they're already current makes them dismiss the issue ("I already have that"), and silently closes a real, unrefuted bug.

**How to apply:** Map release tag → `gh release view <tag> --json publishedAt` and compare against the fix's merge date before claiming "you're on an old build." Keep the fixed-crash defect and the unrefuted-runtime defect as *separate* threads. When a human maintainer is assigned, let them own reporter-facing comms rather than stacking a third bot comment.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781251548493-verify-reporter-s-release-actually-predates-the-fi.md`_

---
title: "Rerun supersedes attempt-1 logs — capture receipts before rerunning"
type: learning
topic: verification
source: learnings/1784182764154-rerun-supersedes-attempt-1-logs-capture-receipts-b.md
---

# Rerun supersedes attempt-1 logs — capture receipts before rerunning

**Rule:** If you intend to cite an attempt-N FAILED line as evidence (e.g. a Sig-B `static-const-matrix-array.slang.3 syn (llvm)` receipt for #11951), copy the exact run-id + job-id + timestamp + the literal FAILED line into your report/log **before** you `gh run rerun --failed`. The rerun creates attempt N+1 and `gh run view --log-failed` then returns only the newest attempt (and "still in progress" until it finishes) — attempt-N's failed logs become non-re-pullable. Observed 2026-07-16: cited a genuine attempt-1 FAILED syn(llvm) line on PR #12109, then reran; when parent disputed the datapoint I could no longer re-pull attempt-1 to defend or retract it.

**Also:** a `ld: invalid or unhandled FORM value 0x23` DWARF line is a *warning-class* symptom that can co-occur with a real, PR-tied link error (e.g. `-fno-rtti` → `undefined reference to typeinfo`/`vtable for`). Do NOT classify a sanitizer/link failure as infra-flake off the DWARF line alone — grep the same log for `undefined reference|typeinfo|vtable for` first. If the real error is a typeinfo/RTTI link break it's legitimate/author-owned and a rerun won't fix it. My grep missed it and I mis-called the job intermittent.

**Why:** both errors cost a wrong rerun + an unverifiable evidence claim. Cheap to avoid: capture-before-rerun, and confirm the actual linker error line, not the DWARF noise.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1784182764154-rerun-supersedes-attempt-1-logs-capture-receipts-b.md`_

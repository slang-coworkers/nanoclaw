---
name: feedback_an_issue_body_is_a_frozen_pre_triage_snapshot
description: "An issue body is frozen at filing; triage findings land in COMMENTS and never retroactively in the body — so quoting the body silently REVERTS the triage, and it fails in the humble direction, which is why nobody challenges it"
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-12361-followup
---

# An issue body is a frozen pre-triage snapshot

**My error, slang#12355, 2026-08-05, caught by slang-triager before it hardened.** I indexed the row
as *"body says no crashing repro produced — it rests on a code read."* That sentence really is in the
body (line 52) and was **true at filing, 03:28:13Z**. The verdict comment `5187353230` landed
**03:56:55Z — 28 minutes later** — and opens *"confirmed, and reachable — this is a real crash, not
hygiene."* Both texts are live on the same issue.

⇒ ⭐⭐⭐**Triage findings land in COMMENTS and never retroactively in the BODY.** So quoting the body
doesn't merely omit later findings — it **silently reverts every one the triage added.** The body is
not "the summary"; it is the oldest layer of the record.

## Why this one is more dangerous than an over-claim

⛔⭐⭐⭐**It fails in the HUMBLE direction.** The pre-triage text is the more cautious of the two, so
inheriting it reads as rigor. An over-claiming error gets challenged; an under-claiming one **gets
thanked for its caution and propagates unopposed** into indexes and upward reports. I had even
labelled my hedge as a caveat (*"body says … it rests on a code read"*), which is the diligence-slot
framing this store already flags: a caveat asserts the checking happened, so nobody re-checks.

⚠️Note the asymmetry in *cost*, not correctness: an under-claim here would have told a maintainer his
confirmed crash was speculative — i.e. it can also destroy work, not just under-sell it.

## Three cheap checks, cheapest first

1. ✅**`comments >= 1` is the tell that the body is not the whole record.** #12355 had `comments=2` and
   **I had already fetched that count** — the discriminator was in my hand, unused.
2. ✅**Let LABELS settle it independently.** `reproduced` is applied only when a counterfactual earns
   it, so **`reproduced` + "unconfirmed code read" is a self-contradicting row** — catchable with no
   comment fetch at all. ⭐⭐**Prefer a check that contradicts itself when wrong** over one that needs
   an extra call.
3. ✅**When summarizing an issue's confidence level, read the NEWEST bot verdict, not the body. If they
   disagree, the verdict wins and the body is simply old.**

## What was actually measured on #12355 (the superseding finding)

Stub `libslang-glslang-<ver>.so` exporting all nine probed symbols **except** `glslang_linkSPIRV`,
injected via **`-spirv-opt-path`** (⚠️not `LD_LIBRARY_PATH` — RUNPATH `$ORIGIN/../lib` wins). Four
cells, both controls passing: real+2 modules ⇒ 0 (964 B linked SPIR-V); **stub+2 ⇒ 139 SIGSEGV**;
stub+1 ⇒ 255 graceful diagnostic; real+1 ⇒ 0. `SA_SIGINFO`: `si_addr=(nil)`, **`RIP=0x0`** ⇒ a call
through a null **function pointer**, not a data deref.

## The companion rule, same shape inverted

My `botcmts=0` audit finding is this error's mirror: **three of four zero-comment rows were deliberate
silences with recorded reasoning** (#11573, #11612 — maintainers' own roadmap items). Acting on the
count would have posted automated triage **over a recorded stand-down**.
⇒ ⭐⭐⭐**"Missing" and "declined" are indistinguishable from outside; so are "unconfirmed" and
"confirmed-elsewhere-in-the-record."** In both cases a counting instrument cannot see intent or
recency, and in both cases the wrong reading is the conservative-looking one.
⇒ ✅**Remedy proposed by the peer and worth adopting: memos carry an explicit `NO GitHub comment —
reason:` line**, so an absence is self-documenting rather than inferred from a zero.

Related: [[slang-unindexed-triaged-backfill-index]] (the row, corrected in place),
[[feedback_delivered_artifact_missing_index_row]] (the recorded-vs-unindexed original),
[[feedback_two_absence_failures_one_evades_controls]] (screened-out output I already held),
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]] (the humble-framing family),
[[feedback_sibling_write_under_shared_bot_identity]].

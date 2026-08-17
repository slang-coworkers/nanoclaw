---
title: "A correction is not applied until you ask where else the claim lives — private notes, shared atoms, synthesized wiki, mirrors, index lines"
type: learning
topic: verification
source: learnings/1785774600509-a-correction-is-not-applied-until-you-ask-where-el.md
---

# A correction is not applied until you ask where else the claim lives — private notes, shared atoms, synthesized wiki, mirrors, index lines

**Symptom (slang-rhi#800, 2026-08-03).** Both Main and `slang-pr-approver` retracted the same claim —
that Devin's Metal residency 🔴 was *refuted* — and both then reported the chain closed. It wasn't. The
retracted framing was still live on **seven** surfaces in `/workspace/shared/`, where it fed every
coworker's Step-0 recall:

- `learnings/1784338866210-…-metal-direct-enco.md` (root atom, title + body)
- `wiki/learnings/1784338866210-…` (derived mirror, own frontmatter `title:`)
- `sources/learnings/1784338866210-…` (third copy)
- `wiki/concepts/review-approver-challenger-calibration.md` — **two** sections, one presenting #800 as
  the *archetype* of a false-positive refutation
- `wiki/index.md` and `wiki/topics/slang-compiler.md` pointer lines
- `learnings/1785770830139-…-an-execution-co.md`, asserting the refutation now had *execution* behind it

Fixing one file left six teaching the error.

**Two mechanisms make this invisible to a normal self-check.**

1. **You grep your new wording.** After writing the fix you naturally search for `NOT-CLEARED` /
   `overclaim` to confirm it landed — a pattern that **cannot match** the stale text, which uses the old
   vocabulary (`refuted`, `false-positive`). A search for your correction is not a search for what it
   replaced. Grep the **superseded** terms, or read the file end-to-end.
2. **Derived layers inherit and re-frame.** A synthesized wiki quotes atoms under its own headline. A
   corrected atom sitting under `## False-positive refutations` still teaches the wrong lesson, because
   the *framing* is what a reader takes away. Titles and index lines are what recall surfaces first — a
   reader may never open the body.

**Procedure.**
- Enumerate surfaces before declaring done: private notes, shared atoms, **mirrored copies**, synthesized
  wiki/concept pages, index + topic pointer lines, frontmatter `title:`, embedded JSON.
- Under an append-only convention, **quote the retracted sentences verbatim** in the retraction so a grep
  for the old words lands on the correction, and name the controlling account.
- **Retract at paragraph granularity.** On #800 the Metal residency *taxonomy* (direct encoder operand ⇒
  auto-resident; GPU-address-in-argument-buffer ⇒ needs `useResource` on the `!m_hasResidencySet`
  fallback) and the coverage-closing checklist are correct and survive. Only the inference that the
  taxonomy was **sufficient to clear the finding** is retracted. Wholesale deletion loses good work.
- **Verify with a positive control.** A zero-hit negative sweep proves nothing if the pattern is broken;
  confirm the same patterns return non-zero somewhere. Final state here: 0 uncorrected occurrences across
  6 patterns, positive control live.
- **`/workspace/shared/` is Main-write-only.** A coworker who finds a stale shared claim can only report
  it; the repair is Main's to perform. Treat such a report as a work item, not an acknowledgement.

**The underlying substantive correction, for anyone who recalls the #800 atom:** residency is **NOT-BLOCK
but NOT-CLEARED**. `registerResource` is gated on `m_hasResidencySet` (`metal-device.cpp:611`), so
"every buffer is registered regardless" covers only the residency-set path — never the fallback the 🔴 was
about. The merged CI run executed all three `compute-indirect*.metal` cases (132 vs 129 metal-PASSED, +3),
closing the separate test-mask gap, but it cannot say *which* residency path ran: the success path emits
nothing (`:129`), and the fallback emits `Info`, routed to doctest `INFO()` and flushed only on failure or
`-v` (`tests/testing.cpp:209-219`). Zero `[Info]` lines in either log is **uninformative by
construction**. The fallback merged unverified; only a `SLANG_RHI_METAL_NO_RESIDENCY_SET` run closes it.

**Generalizable:** reasoning from an **absent** log line needs two proofs — (a) the line would be
*emitted* on the path you are excluding, and (b) it would be *printed at that run's verbosity*. Here (a)
held and (b) failed, which is what made the silence look like evidence.

## ⚠️ ADDENDUM (2026-08-03 17:30Z) — this atom had only the NEGATIVE half of the rule

Everything above says *find and remove the stale claim*. It never says *verify the replacement landed*. That
omission bit the very chain that produced this atom, at its last exchange: a coworker checked that a
now-retracted over-general claim had **not** reached the shared store (negative check: clean) and never checked
whether the **corrected** version **had** (positive check: it hadn't — the conclusion existed only in the
message transcript, invisible to every future Step-0 recall).

**A correction has two verifications, and they are different queries:**

- **Negative:** the superseded wording is gone from every surface → `grep` the **OLD** vocabulary.
- **Positive:** the replacement is **present** on every surface that needs it, including tiers you don't own
  and stores a peer cannot write → `grep` the **NEW** vocabulary, per surface.

Doing only the negative half leaves a **hole rather than a wrong answer**, which is exactly why it survives
review: nothing contradicts a claim that is simply absent. Same asymmetry as over-correction being a false
negative you chose — and the same failure class as treating a conclusion stated in a message as recorded.

**Operationally:** after any correction, run both greps and name the surfaces. If the replacement is a
*conclusion you want future readers to act on*, a message does not count as a surface.

---

## 🔴 POLARITY CORRECTION (2026-08-03 17:32Z) — this file's residency framing is INVERTED

**Controlling account:** `1785778241162-approver-calibration-a-caveat-can-be-wrong-in-the-.md` (and Main's
`project_slang_rhi_800_metal_dispatch_indirect`). Where this file conflicts with it, that wins.

**Retracted wording, quoted so a grep for the old vocabulary lands here:** any statement that the
`!m_hasResidencySet` **fallback** is the *unverified / uncovered / merged-unverified* path, and any statement
that a run with **`SLANG_RHI_METAL_NO_RESIDENCY_SET`** is the *missing artifact* that would close the gap.

**The truth is the reverse.** `m_hasResidencySet = true` is set **only** inside
`else if (m_device->supportsFamily(MTL::GPUFamilyApple6))` (`src/metal/metal-device.cpp` L121, verified at merged
`d8c609ef`). The hosted `Apple Paravirtual device` on `macos-26-arm64` (image `20260728.0273`) **lacks Apple6**, and
a sibling job on that same image logs the terminal-`else` message `GPUFamilyApple6 not supported; using per-encoder
useResource fallback`. ⇒ **CI runs the FALLBACK by default.** So the fallback is the path that actually executed
(and is very likely covered by the passing `compute-indirect*.metal` cases); the **residency-SET path is the
uncovered one**, and it needs Apple6-capable hardware CI does not have. ❌ Do **not** cite
`SLANG_RHI_METAL_NO_RESIDENCY_SET` as the missing artifact — CI is already on that path. The missing artifact is an
**Apple6 run**.

Held as a strong same-image/same-adapter **inference**, not a same-run observation: the green #800 job logs carry no
residency line either way, because `debugCallbackOutput` is captured **only** inside `RETURN_NOT_AVAILABLE`
(`tests/testing.cpp:884`) — a device-*unavailable* path. The affirmative evidence lived in a **failing probe on a
different job**, not in the logs we kept re-reading. This does **not** retroactively turn the withhold into an
approval: *unresolved* was accurate; **which** path was unresolved was inverted.

⭐ **Durable lesson: NARROWING a claim is not TESTING its premise.** "The fallback is unexercised" was retracted
and rewritten as "the fallback is unverified" — weaker, same direction, same untested premise (*which path does
CI take?*). A retraction that narrows without testing the premise **inherits the error and launders it as
diligence.** Ask what observation would settle it, and whether that observation is cheaply available, before
recording either version. Here it was one unauthenticated `curl` of a public job log.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785774600509-a-correction-is-not-applied-until-you-ask-where-el.md`_

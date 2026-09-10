---
name: feedback_a_claim_about_master_needs_its_sha
description: "'branched from current master' / 'at HEAD' / 'no coverage today' are claims about whenever the READER checks, not what you measured. Anchor to the SHA. Recurred in a2a 2h after being patched out of a public artifact — a 'publication rule' is a messaging rule too."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1dd5892a-bf52-4274-8dd1-46df09e77581
---

# A claim about `master` needs the SHA it was measured at

**2026-08-06, slang#12371.** Two instances, ~2 hours apart, same defect, different registers.

1. **Public artifact.** The peer's GitHub verdict comment said a fix should be *"branched from
   **current master**"*. True at write time; stale for anyone reading days later — and the SHA
   (`9cd92bb3a`) was already sitting in the same sentence. Patched to **"branched from `master` at or
   after `9cd92bb3a`"**.
2. **a2a, two hours later.** The same peer told me *"there is nothing left to stack on — verified
   `9cd92bb3a` is an ancestor of `origin/master`"*. By then `origin/master` was **`9eb90c50a0`**
   (#12357, "Fix segfault on empty capability switch case"), one commit ahead. The statement stayed
   true **by luck**: I checked, and the new commit touches `slang-lower-to-ir.cpp` + one test —
   `select(test("slang-emit|tests/library"))` → **0**, and `9cd92bb3a` still an ancestor. Conclusion
   survived; the reasoning had expired.

⇒ ⭐⭐⭐ **Name the SHA you measured at, or you have made a claim about whenever the reader checks.**
`current master`, `at HEAD`, `latest`, and bare `today` are all the same defect.

## Why it recurred after being fixed

The peer had filed it as a **publication** rule — so a2a felt exempt, *"just a message."* ⭐⭐ **But
downstream agents act on messages exactly as they act on artifacts, so the register distinction was
never real.** A rule scoped to "public writing" will re-fire in conversation within hours.

## Sweep the class, not the instance

The right follow-up (peer's, and it's the reusable half): after fixing one occurrence, grep the whole
artifact for the *class* — `current master` / `at HEAD` / `latest` → 0, then **print the remaining
candidate hits rather than counting them**. Two survived and both were fine on inspection: "now
resolved" referred to the report's open questions, not master; "no real validation coverage **today**"
was a claim about the test suite, re-derived at the new head (both `-skip-spirv-validation` flags
still present ⇒ still true). ⭐ **Printing rather than counting is what distinguishes a safe hit from
a defect** — the same discipline that caught a guard regex matching an exit code `255` instead of an
error count, and see [[feedback_a_risk_does_not_license_a_mechanism]] on apertures generally.

Best practice observed: the comment **self-anchors**, opening *"Confirmed at master `b0e43d657`"* —
one sentence that makes every later claim in it re-derivable.

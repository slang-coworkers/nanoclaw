---
name: feedback_a_transmitted_artifacts_size_belongs_to_the_send
description: "Two paired lessons from slang#12362 09:18Z — (a) for an already-sent artifact the size belongs to the TRANSMISSION not the file, so never re-measure and re-DESCRIBE; (b) anchor a prefix comparison to the SHORTER file's real length, because a misaligned matcher manufactures a false refutation of a peer"
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-12362
---

# A transmitted artifact's size belongs to the SEND, not to the file

**Two coupled failures in one exchange (slang#12362, 2026-08-05 09:08→09:18Z), one on each side.
Both are about a figure that was true at some moment and false at the moment it was used.**

## 1. The peer's: describing a past action with a present measurement

A coworker sent a 155-line memo at 09:08, **appended** a validation section at 09:14, then at 09:16
reported "203 lines sent." Only one `send_file` ever happened. Both numbers were individually
correct — 155 at send time, 203 on disk — and the composite claim was false.

⭐⭐⭐**RULE, narrower than "state artifact sizes": for anything already transmitted, the size is a
property of the TRANSMISSION, not of the file. They diverge the instant you keep editing. Take the
figure from the send, or re-measure AND re-send — never re-measure and re-DESCRIBE.**

**Why:** the recipient can only verify against what arrived. A figure re-measured on the sender's
disk and narrated as a description of the send is unfalsifiable from the recipient's side *until*
they happen to hold an earlier copy — which is exactly the accident that exposed it here.

✅**What worked, and is worth preserving:** the sender stated the size **both** times. That
redundancy is what made the gap visible at all. The defect is not "failed to state a size" — it is
"measured at report time rather than at send time." **Don't fix this by stating fewer figures.**

**Family:** same shape as *a near-miss figure is a boundary, not noise*, but the boundary here is
**temporal** and the reporter moved it themselves. Also a sibling of
[[feedback_delivered_artifact_missing_index_row]] — that one is work done and never indexed; this is
work described as delivered in a state it was never delivered in.

## 2. A false mismatch that BOTH sides could have caused — and the result cannot tell you which

To test the peer's claim *"lines 1-156 are byte-identical"*, I ran `head -156` on **both** files.
The older file is **155** lines, so one side yielded 155 lines and the other 156, the hashes differed,
and I nearly published **"DIFFER ✗"** — a refutation of a peer's specific numeric claim.

⚠️**ATTRIBUTION CORRECTED (09:22Z), and it inverts my first reading.** I initially recorded this as
*entirely my own off-by-one.* The peer then measured and **took the blame back, correctly**: line 156
of the new file is a **blank separator it added together with the new section**, so it is *new*
content. The true statement is **lines 1-155 identical / new material 156-203**; its "1-156" was
off by one. ✅**I verified this independently rather than accept the reattribution:** its quoted
`head -155 | sha256sum` = `54dedb0089d00c30697f61d439308ab2871ab19e9cfc7a19c126091a90d9b9a4` matches
mine to all 64 chars; `head -155 NEW` is **exactly 9,581 bytes** = the entire old file; `sed -n 156p`
is a bare `$` (empty line); and its prescribed must-fail control at `head -154` yields a **third
distinct hash**, so the comparison discriminates length, not just content.

⇒ **My `head -156` was a FAITHFUL execution of a boundary that was itself wrong.** So the rule below
is *more* valuable than I first thought, not less: it protects the checker from **the claimant's**
error, which is the case you cannot detect by being careful with your own arithmetic.

⭐⭐⭐**THE DEEP POINT (the peer's, and it's the best thing to come out of this exchange): the
claimant's imprecision and the checker's parameter choice produce the SAME false-mismatch signature,
so the RESULT ALONE CANNOT TELL YOU WHOSE FAULT IT WAS.** Only re-deriving the boundary independently
separates them. ⇒ **"state the figure" and "never trust the stated figure as your comparator's
parameter" are BOTH load-bearing simultaneously, and are not in tension** — the first makes the error
visible, the second keeps it from becoming a false accusation.

⭐⭐**Had I published "the files differ at 156," the FINDING would have been literally true while the
CONCLUSION ("his prefix claim is false") was not.** A true measurement can carry a false conclusion
when the measurement's parameter came from the claim under test — **that is a test assuming its own
conclusion.**

Anchored correctly (`head -155`, the shorter file's real length), the old copy is a **byte-exact
prefix** of the new one: `sha256(OLD) == sha256(head -c 9581 NEW)`, `diff` empty.

⭐⭐⭐**RULE: when comparing a prefix across two files of different length, anchor the window to the
SHORTER file's ACTUAL length — never to the boundary quoted in the claim.** A peer's "lines 1-N" is
1-indexed prose about *their* file; it is not a `head -N` argument for yours. **A CLAIMED BOUNDARY IS
AN ASSERTION UNDER TEST — using it as your comparator's parameter makes the test assume its own
conclusion.**

⛔⭐⭐⭐**A refutation of someone else's numeric claim is the highest-risk output there is: it is
adversarial, it reads as rigorous, and a one-off in your own matcher fabricates it out of nothing.
RE-DERIVE THE MATCHER BEFORE PUBLISHING ANY MISMATCH.**

⚠️**My full-file control FIRED ("files differ ✓") while the result was still WRONG** — it proved the
comparison was live, not that the window was aligned. Textbook instance of
[[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]]: a control proves you read
the right *file*; it cannot detect a misaligned *window*. The control that would have caught it is a
**byte-prefix test with a deliberately wrong length that MUST fail** — which I only added on the
second pass.

## 3. The corollary the same exchange produced: a count is meaningless without its build state

The peer quoted `2192/2194` and `2194/2194` for "the test sweep." Not one sweep re-run — **two
different binaries** (one-liner with the sibling PR reverted out for clean attribution, vs both fixes
present). I had framed it as "volunteered the reason," which understates it: **there was never a
discrepancy to reconcile, there were two experiments.**

⭐⭐⭐**Quote no pass/fail count without naming the build state it was taken in. A bare "2194/2194" is
not a fact, it is a fact-shaped fragment.**

## Trigger

Fires whenever you (a) report the size/line-count/hash of something you already sent, (b) compare a
prefix or range across two artifacts of differing length, (c) are about to tell a peer their number
is wrong, or (d) quote a test pass count.

Related: [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]],
[[feedback_delivered_artifact_missing_index_row]],
[[feedback_a_size_figure_names_a_file_check_which_one]],
[[project_12362_nonmatching_handlers_escaping_throw_hang]].

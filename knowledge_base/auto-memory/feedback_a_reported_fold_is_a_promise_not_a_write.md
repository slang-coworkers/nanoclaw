---
name: feedback_a_reported_fold_is_a_promise_not_a_write
description: "I told a peer I had 'folded' their warning into a live task; the distinguishing instruction pre-existed and I never edited the task. A verb about my own artifact, asserted in the same turn I decided to do it, reads as done."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6814333a-3933-498e-a3fc-7ebf564c6556
---

# "I folded it in" is a plan until the row changes

**Measured 2026-08-09, shader-slang/slang#12443.** Closing a message to `slang-triager` I
wrote: *"I have folded it into the gate task — a `linked_pr` wake now has to distinguish 'the
fix' from 'another suppression'."* Then I checked my own task row:

```
ncl tasks get --id i12443-design-gate-71e8   # prompt: 6085 chars
'nightly': 1  'green': 1  'suppression': 1  '12444': 1
```

Every hit was **pre-existing text from when I created the task** — `"(the reporter own
agentic-nightly-green PR)"` and `"or another test-suppression PR"`. The keyword census looked
like confirmation. Reading the *context* around each hit showed the task never carried the
peer's actual finding: that #12444 turns the nightly **green while the bug is live**, so
nightly redness can never resurface the chain. **I made no edit at all.** The claim was false
when I sent it, and it was about an artifact only I can see.

## Why this shape is dangerous

⭐⭐⭐ **A verb about my own artifact, written in the same turn I decided to do the thing, is
indistinguishable from a report that I did it.** "I have folded it in" carries the same
grammar as "I have verified it". The peer has no way to check — the task lives in my group's
DB — so it goes into their memo as a fact about the system's state. They then wrote back that
they had *hoisted the warning to the top of their brief*, which they had; the asymmetry is
that their claim was checkable and mine was not.

⭐⭐ **The near-miss detector was a keyword count, and it voted the wrong way.** `grep -c`
on `nightly|green|suppression|12444` returned all-non-zero, which reads as "it's in there".
**A term appearing in an artifact does not mean the CLAIM containing that term appears.** The
fix was to print ±220 chars around each hit — one extra command, and the illusion collapsed.
⇒ **For a "did I write X?" check, read the SENTENCE, never the token count.** Cf.
[[feedback_a_stored_claim_re_shipped_as_a_live_finding]] (a stored figure reads as a
measurement); this is its write-side twin — an *intended* write reads as a completed one.

⚠️ **Claims about un-inspectable state are the ones to slow down on.** Anything in
`/workspace/agent/**`, my own task rows, my own memory store: the peer cannot audit it, so
the only check that will ever happen is the one I run. **The absence of an auditor is exactly
why it needs the audit.** See [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]
for the general form — I stated a mechanism existed because I had designed it.

## What I did after finding it

Amended the row for real (`ncl tasks update --prompt`, 6085 → 9281 chars) and re-read it back
**from the DB, not from the file I composed**, with a negative control (`zzz-not-present: 0`)
so a silent no-op couldn't pass as success. Then corrected the peer explicitly rather than
letting a false claim about my own state stand in their memo — see
[[feedback_audit_credit_as_hard_as_blame]]: a fabricated fact still live in a peer's store
ships regardless of who declared the thread closed.

⇒ **Before writing "I have <verb>ed it", name the command that did it.** If the answer is
"the one I'm about to run", write "I will" — or run it first and then report.

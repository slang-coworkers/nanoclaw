---
title: "grep -c for orientation, read the hits before publishing the number"
type: learning
topic: misc
source: learnings/1786002658196-grep-c-for-orientation-read-the-hits-before-publis.md
---

# grep -c for orientation, read the hits before publishing the number

Four wrong counts in one chain, across two agents, all the same defect: **a number produced by a
matcher nobody interrogated, published as a fact about the world.** The remedy that worked both
times was not a better regex — it was *reading the matched items*.

**The instances (shader-slang/slang#12386, 2026-08-06), all on claims headed to a maintainer:**

| published | actual | why the matcher lied |
|---|---|---|
| "~15 `AddressSpace` members" | **26** | a `sed` window ended at `StorageBuffer`; the window's edge was read as the enum's end |
| "3 members" (my first count) | **26** | regex required `= value`; most enumerators take implicit values |
| "3 test files cover this" | **~0** | 2 of 3 hits were the token inside a `//` comment; the 3rd never reaches the code path |
| "1 test covers this" | **0** | that test is a `DIAGNOSTIC_TEST` asserting *rejection*; it never reaches the arm |

**The rule.** `grep -c` answers *"how many hits?"*. The claim you publish is always *"how many
instances?"*. Those diverge exactly when the matcher hits **prose, a comment, an enum brace, a
window edge, or code on a path that never executes** — i.e. in most real cases. So: **count for
orientation, then read the hits before the number goes in an artifact.** Cheap, because N is almost
always small precisely in the cases that matter.

**Why a control does not save you here.** My must-hit control (20 files mention `AddressSpace`)
*passed*, and correctly — the instrument was working. What a control validates is that the matcher
**fires**; it cannot tell you the hits are the *kind of thing* you're claiming. A passing control on
a semantically wrong count is the most convincing possible wrapper for a false figure.

**Two mechanical checks that would have caught three of the four:**
- Strip comments before claiming code presence: `sed 's://.*::' f | grep -c PATTERN`. ⚠ And test the
  stripper — my first attempt filtered *matched lines* for a leading `//` and returned "1 code hit"
  for a file whose only hit was on a comment line. A broken filter reads exactly like a finding.
- For enum/list counts, print the members and eyeball the tail. If your count is suspiciously small
  against a construct you just read, that is the tell — mine said 3 for a switch I had read moments
  earlier.

**Direction matters when reporting.** A coverage number is asymmetric: publishing "3 tests cover
this" when the answer is ~0 leads a maintainer to the **opposite** conclusion from the truth, so it
is worth a correction patch on its own. Publishing "~15 latent cases" when it is ~23 understates
your own argument — worth fixing, but it fails safe.

**Related shape, same chain:** a caveat is also a claim and inherits no immunity from being
cautious — I issued a "grep treats emitted output as binary" warning that was true of `.ptx`
(1 NUL) and false of `.cu` (0 NULs), and a peer was right to *measure* rather than retract sound
evidence on my say-so. Over-retraction costs as much as over-claiming and reads as rigour.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786002658196-grep-c-for-orientation-read-the-hits-before-publis.md`_

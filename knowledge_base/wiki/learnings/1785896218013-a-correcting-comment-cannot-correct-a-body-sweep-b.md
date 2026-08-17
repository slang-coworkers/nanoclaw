---
title: "A correcting comment cannot correct a body — sweep by artifact"
type: learning
topic: misc
source: learnings/1785896218013-a-correcting-comment-cannot-correct-a-body-sweep-b.md
---

# A correcting comment cannot correct a body — sweep by artifact

Posting a correction *feels* like correcting the issue, because the comment lands on the issue. It doesn't. On a multi-artifact surface (GitHub issue/PR), the body, each comment, the labels, and cross-referencing pages on other issues are **separately editable artifacts**. Appending cannot fix what precedes it.

**The miss:** on slangpy#1091 I posted a thorough retraction as comment 2 and reported the chain corrected. Meanwhile the body still asserted "only the Python surface is immune" plus an entire "The specific victim" section built on the premise I'd refuted, and comment 1 still asserted the retracted rank cap — both unmarked, both reading as current. A cold reader goes body → comment 1 → comment 2 and meets two confident refuted claims before reaching the correction.

**The test to apply:** *if someone reads from the top and stops early, what do they believe?* If the answer is the refuted version, the correction isn't done.

**Sweep procedure:**
- **Body** — `gh api repos/{o}/{r}/issues/{n} --method PATCH`. Prepend a marked `[!IMPORTANT] CORRECTED <date> — see <link>` block, and **annotate the stale sections rather than deleting them** (`[!WARNING] REFUTED — retained for the audit trail`). Deleting destroys the record of what was believed.
- **Stale comments** — `gh api repos/{o}/{r}/issues/comments/{id} --method PATCH`, prepending a *scoped* supersede note that says which claims fell and which still stand. GitHub preserves edit history, so the trail survives while the stale text stops reading as current.
- **Labels** — a severity revision that lives only in prose isn't applied; the label is the machine-readable copy. **Check the label exists first:** slangpy has 35 labels and **no P0–P3**, so a P3→P2 revision is simply not representable there — say so rather than inventing one. (I also briefly added `slangtorch_parity` before reading its description, "parity with functionality from slang-torch" — wrong label, removed. Read the description, not the name.)
- **Cross-references on other pages** — a stale claim restated in another PR's description is heading to a different human reviewer. Route it to whoever owns that branch; don't edit across chains.

**No "not mine to edit" excuse when it's our own bot's text.** And note the ordering trap: I'd already flagged the *labels* gap nowhere, because the triage workflow's step 9 talks about posting comments, which quietly framed the whole job as comment-shaped.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785896218013-a-correcting-comment-cannot-correct-a-body-sweep-b.md`_

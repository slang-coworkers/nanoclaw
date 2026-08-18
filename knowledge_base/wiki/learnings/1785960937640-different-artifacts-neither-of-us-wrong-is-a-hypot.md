---
title: "'Different artifacts, neither of us wrong' is a hypothesis about two sentences — verify each subject separately"
type: learning
topic: verification
source: learnings/1785960937640-different-artifacts-neither-of-us-wrong-is-a-hypot.md
---

# "Different artifacts, neither of us wrong" is a hypothesis about two sentences — verify each subject separately

A peer and I published different counts for the same checklist: it said 6 per-sprint items, I said 7. It reconciled this generously — "the issue body has 6, the template on the PR branch has 7, different artifacts, neither of us miscounted" — and closed the matter as nothing owed.

**Its numbers were exactly right. My sentence was still wrong.** I re-measured (counting `| <n> |` rows per section): body = 8 daily / 6 per-sprint; template = 8 daily / 7 per-sprint. But my memo read *"opened 2025-09-24 with a checklist (8 daily + 7 per-sprint items)"* — a sentence whose **subject is the issue body**, which has 6. Right number, wrong artifact. The reconciliation was true about the *numbers* and false about *my claim*, and because it absolved both sides it removed the reason to check.

**The rule:** a near-miss count names a version/unit/**artifact** boundary — but "both right, different artifacts" is a hypothesis about *two sentences*, and each sentence's **subject** must be checked independently. Two true numbers do not make two true sentences.

**The correction paid a dividend, which is the argument for doing it.** Diffing the full line sets (template minus body) returned exactly 5 added lines: 4 frontmatter keys, plus row 7 — *"At the end of the sprint, reset values in this table to 'Not started', and update sprint number"* — present nowhere in the body. That single row is what makes the artifact a **reusable template** instead of a copy of the body: the one substantive thing the automation actually authored. Symmetric absolution would have buried the most interesting fact in the diff.

**Meta-lesson: audit hardest when the correction favours you.** Most of my verification guards face *blame* — don't absorb blame that isn't mine, don't assign blame that isn't someone's, verify a diagnosis before relaying it. Almost none faced *credit*. A peer volunteering "neither of us was wrong" while praising the handoff is precisely the packaging that suppresses a check, and mis-assigned diligence manufactures trust nobody earned. Same family as *the right answer to the wrong question* and *a caveat aimed at the wrong claim* — the check runs, returns something true, and terminates before reaching the defect.

**Scope the repair to where the defect reached.** My public comment contained no per-sprint count at all (probed: three count phrasings → 0 each; non-zero control → 3), so the fix was local-only. Editing the public artifact would have added confusion, not removed it.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785960937640-different-artifacts-neither-of-us-wrong-is-a-hypot.md`_

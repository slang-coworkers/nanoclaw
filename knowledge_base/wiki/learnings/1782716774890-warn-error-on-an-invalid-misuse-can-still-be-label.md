---
title: "warn→error on an invalid *misuse* can still be labeled pr: non-breaking (maintainer call, slang #6216)"
type: learning
topic: slang-compiler
source: learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md
---

# warn→error on an invalid *misuse* can still be labeled pr: non-breaking (maintainer call, slang #6216)

**Incident (slang PR #11705, merged 2026-06-27):** A diagnostic was escalated warning→error (`[[vk::location]]` on a descriptor-bound resource now errors E39021). The fixer reasonably relabeled `pr: non-breaking` → `pr: breaking change`, since warn→error makes previously-compiling code fail. But maintainer @jkwak-work reverted it to `pr: non-breaking` before merge and merged it that way.

**Lesson:** In Slang, "breaking change" means breaking *valid* existing code or ABI — not breaking code that was *already wrong*. Erroring on a misuse that previously only "worked" by silently miscompiling (here: a cbuffer that mis-bound in declaration order because `vk::location` was ignored) is **not** considered breaking, because no valid program relied on it. So a warn→error escalation is not automatically `pr: breaking change`; it depends on whether the now-rejected code was ever valid/correct. When in doubt, propose the label but defer the breaking/non-breaking classification to the maintainer — they made the final call here.

**Process corollary:** label state on a merged PR is the maintainer's final word; verify it (`gh pr view --json labels` + timeline `labeled`/`unlabeled` actor) before repeating a downstream tier's earlier label claim in an upstream report — it may have been changed by a human.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md`_

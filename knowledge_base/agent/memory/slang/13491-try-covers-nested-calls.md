---
type: chain
title: "slang#13491: one try covers every throwing call in its operand"
description: "Feature request from skiminki-nv (self-assigned), triaged 10-07 as feature + correctness bug, P2, and NO-GO until maintainers decide the design. PARKED on two maintainer decisions; skiminki-nv wants to wait for Yong. spec#63 (merged 10-14) documents the current narrow rule, which is not a decision. Re-chase task rechase-13491-try-covera-ad54 runs 10-21 17:00Z."
---

# slang#13491: let one `try` cover every throwing call in its operand

**Origin.** skiminki-nv (MEMBER, self-assigned) filed this 2026-10-07 from a Discord design thread
(channel `1557395948320325777`). It is the one sibling of #13488/#13489/#13490/#13492 that skiminki-nv called
controversial: *"I think everything else should be uncontroversial, except 13491 … I'd expect that Yong is
back before we get to it."*

**Triage.** slang-triager, comment 6044579342 (10-07 18:48Z): reproduced at 9f31ffcfd. Classified as a feature
with a correctness bug inside it (`try g(f())` miscompiles), medium/P2. NO-GO until maintainers decide. The fixer
holds a reverted prototype at `scratch-13491/prototype.diff`.

**Open decisions (maintainer):**
1. Adopt the coverage model Tess (`tessfactor`) proposed on Discord 10-07 15:27Z: a `try` scopes all nested
   throwing calls, lambda and `do`/`catch` bodies don't inherit it, and E30091 stays an error.
2. Policy for a redundant nested `try g(try f())`: error, valid, or lint. Tess first said error, then
   allowed "unnecessary nesting might still be stylistically preferable". hasse_official prefers the explicit
   `try f(try g())` style.

**Related state (verified 2026-10-14):**
- #13488 closed: #13503 merged 10-09. #13489 PR 1, #13502, merged 10-09.
- #13489 PR 2, draft #13514, implements the **current** narrow rule plus skiminki-nv's A3 identity-conversion
  carve-out. skiminki-nv's review on 10-09: "LGTM, but let's confirm the semantics by waiting until spec#63 is merged."
  skiminki-nv merged master into it on 10-14 16:57Z. That chain is tracked by `rechase-13489-gates-7044`.
- **spec#63 merged 2026-10-14 08:25Z** (approved by tangent-vector). `expressions-try.md` says *"A `try`
  covers only its immediate operand"* and Remark 2 calls #13491 *"a possible solution"*. It codifies today's
  semantics and leaves #13491 open, so it is **not** a #13491 decision.

## Log

- 2026-10-14 17:00Z re-chase: no comment on #13491 since 10-07 and no sibling comment deciding coverage. The
  Discord thread has been quiet on `try` since 10-07; the 10-08/09 posts discuss the panic-vs-throw taxonomy. Yong
  hasn't posted. Still parked. Told dashboard and created `rechase-13491-try-covera-ad54` for 10-21. The firing row
  can't be updated (`no live task matched`), so each re-arm is a new `create`.

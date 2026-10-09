---
type: chain
title: "slang#13490: try inside a lambda is checked against the enclosing function"
description: "Triaged as bug/medium/P2 and reproduced at 9f31ffcfd; not a regression. Approach A is recommended. HOLD: the fixer briefing waits until skiminki-nv (self-assigned) asks for a PR. Operator re-asked once 2026-10-08; final check rechase-13490-final-cc58 runs 2026-10-11T18:00Z."
---

# slang#13490: `try` inside a lambda body uses the enclosing function's error context

**Origin.** skiminki-nv (MEMBER, self-assigned) opened this on 2026-10-07. It is a sibling of #13488, #13489 and
#13491, under umbrella #13492 ([record](../imported/project_13492_throws_on_accessors_ctors_lambdas.md)). This
session routed the `issue_opened` event to slang-triager on `gh-issue-shader-slang/slang-13490`.

**Triage (slang-triager, 2026-10-07 18:41Z).** Comment
[6044429829](https://github.com/shader-slang/slang/issues/13490#issuecomment-6044429829), plus the `reproduced`
label. The memo is in the triager's workspace (`triage-13490.md`, with scratch at `scratch-13490` and
`prototype-B2.diff`). The receipts below come from the triager; I have only verified the GitHub state myself.
- **Reproduction:** at 9f31ffcfd, a Debug build hits the throwAttr assert (lower-error-handling.cpp:167), and a Release
  build aborts or segfaults. The bug goes back at least to 2025.12, so it is not a regression.
- **Root cause:** `visitLambdaExpr` checks the body under `withParentLambdaExpr`, and that context keeps
  `m_parentFunc` and `m_outerStmts` from the enclosing function. Later the synthesized `()` is checked again, but
  `CheckTerm` skips the `TryExpr` because it is already checked.
- **Same leak, more symptoms:** under `throws OtherError` the compiler gives E30095 where it should give E30093, and
  a lambda's `return` inside a `defer` body gets a false E30110.
- **Approach A (recommended):** make the lambda's `()` the error-handling function, with a Bottom error type, and
  push a boundary node on the outer-stmt stack. The triager prototyped this and then reverted it.
- **Constraints on A:** do not clear the stack outright (that breaks the `if (T is IFoo)` refinement with E30403).
  Do not blind-skip the second pass (that loses return coercion in lambda-diagnostics.slang). Duplicate E30115
  still needs a fix.

**Disposition: HOLD (orchestrator decision, 2026-10-07 ~18:45Z).** The fixer was released on #13488 and #13489 only
because skiminki-nv explicitly asked for draft PRs. On this issue they have not asked, and the triage comment offers
a draft PR. The fixer briefing is held in slang-fixer on the canonical thread. The operator can override this with GO.

**Resume.** `rechase-13490-lambda-try-7f0e` runs once, at 2026-10-08T18:00Z. Resume early on a non-bot comment.
- If the author asks for a fix → GO to slang-triager, quoting the author's words verbatim.
- If the author opens their own PR → stand the held briefing down.
- If nothing has changed → re-ask the operator once.

**Re-chase 2026-10-08 18:05Z (rechase-13490-lambda-try-7f0e).** Nothing changed. No human comments since the triage.
The only human activity was jkwak-work removing the `Dev Opened` label at 10-08 01:17Z. No author PR exists. Bot PRs
#13502 and #13514 mention #13490 only as out of scope. skiminki-nv's #13489 A3 ruling (10-08 11:41Z) does not cover
#13490. I re-asked the operator GO/HOLD/DROP **once** on orchestrator-dashboard (msg 33, thread
`gh-issue-shader-slang/slang-13490`). Silence means HOLD. The final check is `rechase-13490-final-cc58` at
2026-10-11T18:00Z. It acts on a maintainer comment or an operator reply and **does not ask again**.

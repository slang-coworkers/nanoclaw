---
type: chain
description: slang#13508 — `[Differentiable]` functions declared `throws` fail with E38105 ×3 (fwd_diff/apply_bwd/remat) since v2026.7, E99997 on master. Bot-filed 10-08 from the #13488 chain. 10-14 the assignee, saipraveenb25, first proposed matching error types, then switched to diagnosing `[Differentiable]` + `throws` instead. Routed to slang-triager.
---

# slang#13508 — `[Differentiable] ... throws` fails to compile

- **Origin:** follow-up found while reviewing PR #13503 (#13488). slang-triager filed it 2026-10-08 02:18Z on my order. The order covered
  filing only, with the issue left unrouted. Parent record: [13488-try-non-throwing-ctor-subscript.md](13488-try-non-throwing-ctor-subscript.md).
- **Content:** v2026.5.2 compiles it; from v2026.7 the declaration alone gives E38105 ×3 against the synthesized `fwd_diff`/`apply_bwd`/`remat`
  requirements, plus E99997 `witnessTable->containsRequirement` (check-decl.cpp:10862) on master. #9808 is a candidate cause, not bisected.
- **Maintainer state:** jkwak-work assigned it to **saipraveenb25** (10-12) and added the `Office-Sai` label (10-13).
- **10-14 15:52Z: Sai commented** (issuecomment-6172417954, MEMBER; the live body matches the payload, never edited). It has no @-mention, but it
  answers our bot-filed issue with a proposed design, the same situation as #13449, so I treated it as addressed to the bot:
  > "Error handling + auto-diff is not particularly well supported right now, but this case should be doable. The fix should be small: just make sure that the expected signatures for fwd_diff/bwd_diff/apply/remat/etc.. use the same error type of the primal func. Then, even if we synthesize a satisfying function that doesn't throw, we should be able to wrap it to satisfy the requirement."
- **Dispatch (10-14):** slang-triager on `gh-issue-shader-slang/slang-13508`, with `<github-post-authorized />`. Task: prototype Sai's design on
  master `f6a839924a`, revert it, reply to @saipraveenb25 with results, and offer a draft PR without opening one. He is the assignee, so the fix
  decision is his. No fixer.
- **Re-chase:** one-shot `rechase-13508-sai-fix-0eea` at 2026-10-16 16:00Z.
- **10-14 16:33:03Z: triager prototype reply posted** (issuecomment-6173226683, 4986 chars). It finds the requirement signatures already carry
  the error type, but the synthesized members (`addSynthesizedFunc`, `trySynthesizeDiffFuncRequirementWitness`) drop it. A 2-line copy plus
  dropping two asserts fixes `decl_only`/`call_primal`. Free `fwd_diff`/`bwd_diff` still break, because `lowerErrorHandling` runs before autodiff.
  It offered a partial draft PR. This is the triager's finding; I haven't verified it.
- **10-14 16:32:54Z: Sai changed direction** (issuecomment-6173223954, edited 16:33:00Z, live body quoted): "Actually, supporting derivative
  methods that throw error might need some more support (i.e. backend needs to handle result types properly during autodiff, which gets even
  more complex when we have dynamic types). For now, I think it makes sense to diagnose differentiable methods that are throwing."
  **It landed 9 s before the bot reply**, so that reply doesn't account for it. Dispatched to slang-triager on the same thread: acknowledge the
  crossed comment, propose the diagnostic concretely, and ask him for a go-ahead and the scope. No PR yet. A go-ahead goes to slang-fixer.
- **10-14 16:48:12Z: diagnostic proposal posted** (issuecomment-6173520602, 2285 chars; I checked it live). It proposes a new E38038
  `differentiable-function-cannot-throw`, checked in `synthesizeDifferentiabilityRequirements`, firing on `DifferentiableAttribute` and its
  subclasses. Three cleanup gaps are disclosed: E30027+E30092 at use sites, E38105 still from `[BackwardDerivative]`, and one double report.
  The suite hasn't been run on it. **Parked on Sai** for two scope questions: (1) free functions too? (2) exempt throwing primal + throwing
  custom derivative, which works on master? Plus a go-ahead for a bot draft PR. The triager's prototype diff is `scratch-13508/prototype-diag.diff`
  and its memo is `memory/issues/triage-13508.md` (both in the triager's workspace). A go-ahead goes to slang-fixer on this thread.

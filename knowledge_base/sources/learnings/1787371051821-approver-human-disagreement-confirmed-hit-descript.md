---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787335931914-lxxx0t
written_at: 2026-08-22T03:57:31.821Z
---

# [approver/human-disagreement] confirmed HIT: descriptive-help-string docs PR is safe when the documented behavior is verified against source at head

**Outcome (calibration join):** slang#12673 — WOULD_APPROVE → MERGED as-is (0 interval commits, merged_by jkwak-work at my exact decided commit `21724b552fc0`). Confirmed HIT / agreement. Bot-authored (nv-slang-bot[bot]) docs+help-string PR documenting version-tolerant `-warnings-disable` numeric-id behavior.

**Transferable class-of-signal (what made this shape safe, and the ONE probe that decides it):** A "descriptive help-string / generated-doc" PR has exactly one correctness failure mode — the prose stating something FALSE about the code. Everything else (ABI, behavior, test coverage) is inert because no code path changes. So the decisive challenger probe is a single source read: locate the function whose behavior is being described and confirm the prose matches it at the pinned head. Here that was `overrideDiagnostic` (`source/slang/slang-diagnostics.cpp`): numeric branch returns `SLANG_OK` on an unknown id (silently ignored), name branch diagnoses `UnknownDiagnosticName` + `SLANG_FAIL` (error) — exactly the two-way distinction the help text claims. When that read confirms the claim AND the generated doc is CI-enforced (`check-cmdline-ref` reruns the generator and diffs), a WOULD_APPROVE is well-founded even on the Devin-only tier with no production review (bot-authored PRs are legitimately skipped by production, harvest exit 20 — not an abstain).

**Sharpens Step-0 recall for next time:** For docs/help-string PRs, don't over-index on the missing production review or the bot authorship — those are expected. Spend the challenger budget on the single behavior-accuracy source read; if it confirms and the doc is generator+CI-backed, the change is as safe as it looks. Corroborating human approval at the exact head (jkwak-work, MEMBER) is confirmation, never the basis. Related: the `[approver/critique-mustfix]` note on avoiding the "byte-identical" overclaim for generated docs — say "matches in content, modulo generator formatting."

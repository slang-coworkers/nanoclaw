---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787827134413-sfyhi4
written_at: 2026-08-27T10:58:44.330Z
---

# [approver/challenger-miss] Test-relaxation PRs: a removed assertion may be testing-away a masked producer bug — read the producer before clearing the gap

## Symptom
shader-slang/slang#12794 (@9c83a63c9d9a): a test-only PR removed one `SLANG_CHECK_MSG` from the DepfileOutput unit test (Test 4) — the assertion that a module's *folded `.slang` source* appears in the depfile — because it failed on Windows-ARM64 only (Fixes #12788, a `regression`-labeled CI failure from #12666). Kept the `.slang-module` dependency assertion. Author + PR body + bot review + Devin + CodeRabbit all framed the removed behavior as an "incidental, platform-dependent" side effect, not a contract. My initial challenger accepted that framing and CLEARED the single 🟡 gap → WOULD_APPROVE.

## Root cause of the near-miss
I judged "incidental vs contract" from the *narrative* (PR body, review prose) instead of the *producer code*. The DECISION_REVIEW codex critique read `source/slang/slang-session.cpp:2250-2274` at the head and showed the folded-source dependency is added by a **deliberate** path: `loadSourceFile()` → `IncludeSystem::findFile()` re-resolves each recorded module source dependency and calls `module->addFileDependency(sourceFile)`. So Windows-ARM64 failing to fold a **physically-present** `a.slang` is not self-evidently benign — it may be a genuine `findFile` relative-path resolution bug that the repo's own methodology ("fix the producer, not the test") would fix upstream. Deleting the *only cross-platform* assertion tests that possibility away on every platform, not just where it diverges.

## How to catch it (the transferable rule)
When a PR **removes or weakens a test assertion** (especially "relax a flaky/platform-dependent check"), the pivotal probe is the same "could this have come out otherwise / is the input shape correct?" question, inverted: **is the behavior being un-asserted an incidental, or is its divergence a masked producer bug?** You cannot answer that from the PR narrative — the author has already concluded "incidental." READ THE PRODUCER that emits the un-asserted output:
- If the output is produced **best-effort with silent fall-through** AND the divergence is on a genuinely-optional input → likely a real incidental (leans clear).
- If a **deliberate code path** produces it and the failing input is present/valid on the diverging platform → a producer bug may be hiding; a platform-guarded assertion (preserve coverage where supported) would have been the principled alternative to outright removal. Uncertainty here ⇒ ABSTAIN(OPEN_GAP), not clear.
Here it was genuinely ambiguous (best-effort add, but physically-present source failing to resolve), and I couldn't run Windows-ARM64 ⇒ conservative-lean ⇒ ABSTAIN.

## Fix
Decision revised WOULD_APPROVE → ABSTAIN_POLICY(OPEN_GAP). For any assertion-removal PR: (1) open the producer of the removed-output before judging severity; (2) prefer "platform-guard / preserve where supported" over "delete on all platforms" as the bar the change must clear; (3) two human approvals at head do NOT settle a root-cause question the abstain merely flags — the abstain doesn't block them, it asks whether the producer should be fixed. Also: `review/devin-commit-status.txt` can be `"unknown"` — don't over-claim "Devin ran head-current" as commit provenance; treat Devin's 0-bug result as supplementary.

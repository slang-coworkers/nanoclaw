---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787213436865-39m9ue
written_at: 2026-08-20T11:31:29.574Z
---

# [approver/calibration] Confirmed-safe: 3× ABSTAIN on a build-breaking chain → author closed the PR unmerged (slangpy#1120)

**Outcome (calibration join).** slangpy#1120 "Update vcpkg to 2026.07.29" was **closed UNMERGED by the author (skallweitNV) himself** at head `b7de143f` — no merge, no follow-up commits, no replacement PR. Per the skill's mapping, closed-unmerged ⇒ REJECTED/CHANGES_REQUESTED-equivalent. Across all three revisions the approver returned **ABSTAIN_POLICY:CHALLENGER_CONCERN** and never approved. **This is a clean confirmation — no false-safe, no human-disagreement.** The abstains correctly refused to round a build-breaking change up to approve, and the human independently reached the same "not shippable" conclusion (abandoned it).

**What the class of change was, and why the approver was right to keep abstaining.** A vcpkg baseline bump touching only `external/**` — the known coverage blind spot: production Claude review skipped the PR shape (harvest exit 20 every revision), CodeRabbit path-excluded `external/**` every revision, Devin ran clean every revision (diff-only, CI-blind, and repeatedly mis-read the diff). ALL automated review signal was structurally absent/blind. The ONLY signal that ever discriminated safe-from-unsafe was the **build check-runs**, read by the challenger — and `ci_green_on_sha` was green (CodeRabbit+CLA) on all three revisions while Windows MSVC was RED on all three.

**The transferable calibration lesson.** On an `external/**` / dependency-baseline bump, the automated reviewers' cleanliness carries ~zero bits (proven three times on one PR); the build check-runs carry ~all the bits. An approver that trusted the clean reviews or the green combined-status would have false-safed a change the author himself ultimately abandoned as un-shippable. Reading CI on every revision — and abstaining on a red head regardless of how the reviewers look — was exactly calibrated. Keep doing it.

**Chain of distinct failures (why "they addressed it" never meant "it's fixed"):** R1 zlib debug-lib lookup in the custom crashpad overlay (2026.07.29) → R2 deleted the overlay, got built-in-port `mini_chromium` MSVC compile errors (2026.07.29) → R3 pinned older 2026.06.24, got a python.org embedded-Python download SSL failure. Three genuine, different Windows MSVC breaks; each revision needed a fresh check-run read, never an inference from the prior. See [[approver/challenger A revision that targets the right area is not a fix]] and [[approver/clause-gap ci_green_on_sha reads combined status]].

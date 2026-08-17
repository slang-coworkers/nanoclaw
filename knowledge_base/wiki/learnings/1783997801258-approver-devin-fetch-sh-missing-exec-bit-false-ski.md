---
title: "approver devin-fetch.sh missing exec bit false-skips Devin"
type: learning
topic: review-process
source: learnings/1783997801258-approver-devin-fetch-sh-missing-exec-bit-false-ski.md
---

# approver devin-fetch.sh missing exec bit false-skips Devin

## `devin-fetch.sh` exec bit missing in pr-approver containers → false Devin-skip risk

**Observed:** 2026-07-14, slang-pr-approver run on shader-slang/slang PR #11987. The Devin-harvest helper `devin-fetch.sh` shipped **without its executable bit** in the approver container. First invocation died with `Permission denied`, which surfaces as a false "Devin skipped / unavailable" signal. The approver recovered by re-invoking via `bash devin-fetch.sh …` and got a clean head-current Devin result — but only because it noticed.

**Why it matters (correctness, not cosmetic):** In shadow-mode approval of **bot-authored** PRs, the production claude-code-action review genuinely skips (harvest exit 20 → Devin-only fallback tier). When Devin is the *only* review input, a silent `Permission denied` false-skip can collapse the review tier entirely → the challenger loses its external signal → a real finding could be downgraded to CLEAN / ABSTAIN_INFRA without anyone noticing. The exec-bit papercut is latent in the container image, so it affects **every** approver run there, and the same skill family feeds `slangpy-pr-approver`.

**How to apply:**
- Approvers: if `devin-fetch.sh` (or any harvest helper) dies with `Permission denied`, treat it as an **infra false-skip, NOT a genuine Devin-unavailable** — re-invoke via `bash <script>` before recording any ABSTAIN_INFRA or Devin-skip. Do not let a missing exec bit masquerade as "Devin skipped."
- Durable fix (source-side, operator/skill-owner): restore the exec bit on `devin-fetch.sh` in the pr-approver skill source so future container builds ship it executable.

Related: [[feedback_approver_never_posts_route_reviewer]] (approver is ledger-only, shadow mode — no GitHub write, so this only affects the recorded verdict's fidelity, not a public post).

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783997801258-approver-devin-fetch-sh-missing-exec-bit-false-ski.md`_

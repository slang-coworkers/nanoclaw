---
title: "Slang PR-Review Pipeline: opencode Dispatch, 429 Recovery, and Run Integrity"
type: concept
group: slang-compiler
tags: [slang-pr-review, dispatch, opencode, rate-limit, 429, recovery, run-dir, diff-integrity, devin, shared-clone, reviewer-a, reviewer-c]
---

# Slang PR-Review Pipeline: opencode Dispatch, 429 Recovery, and Run Integrity

Operational rules for running the local `/slang-pr-review` reviewers (A correctness, C clarity) on the opencode/GLM engine: the dispatch env, surviving the NVIDIA inference-API IP rate limit, verifying diff integrity, Devin first-fetch behavior, and why a moving shared-clone HEAD is harmless. Sibling page for the general runner mechanics (background dispatch, run-dir selection, wait-run.sh, budget): [[wiki/concepts/review-process-f0909b2-pipeline-ops.md]].

## TL;DR

- **The NVIDIA inference-API WAF rate-limits by shared egress IP (429 CPE_RateLimit_IP), not by session concurrency.** A retry that runs alone fails the same way; two failed attempts = stop retrying — recover from what already ran instead.
- **Recovery that worked: the subagent reviews are complete in `<run_dir>/subagents/chatcmpl-tool-*.output` even when `final-review.md` is a stub.** Concatenate them with a provenance header, mark "partial-but-complete-on-substance", set `reviewers_complete:false`, and drift-check `tool-uses.jsonl` by inspection, not by counting greps.
- **Read the diff-integrity hash from Reviewer A's `run.log` first line (the pre-stage JSON), never from `/workspace/agent/slang/tmp/`** — that is shared staging that Reviewer C's outer staging OVERWRITES with a differently-rendered `pr-diff.patch`. Verify by sha256-summing an independently fetched `gh pr diff` against A's run.log value.
- **Dispatch A and C sequentially (A → C only after A exits 0)** and await each with ONE `wait-run.sh --timeout 540` call — sequential dispatch again avoided the 429 on the clean #14532→#14549 runs.
- **On a never-analyzed PR head, Devin's first anonymous fetch triggers the analysis and completes fresh in ~9 min** (within the 15-min cap); confirm `devin-commit-status.txt` says "Analysis is up to date (<head>)" and don't refetch when it matches.
- **A mid-run move of the shared `/workspace/agent/slang` clone's detached HEAD is harmless** — `git clone --shared` reviewers key off the local `master` branch (forced to the PR merge-base), not HEAD. Verify `git rev-parse master` before/after dispatch; only the master branch matters.
- **LLM-subagent exact-encoding arithmetic is unreliable**: verify any suggested exact test constant by hand before putting it in a verdict (four different wrong guesses for `FloatToHalf(0x7fa12345)` appeared across A/C reports).
- Port-drift check for "verbatim port of commit X" claims: `gh api contents/<file>?ref=<sha> --jq .content | base64 -d` both versions, extract the changed functions, diff; comment-only vs semantic drift separates cleanly.

## Dispatch recipe on the opencode engine (GLM group)

For `NANOCLAW_MODEL_WEIGHTS=open` groups the skill install detects opencode as the engine: dispatch Reviewer A with `REPRO_PR_MODEL=openai/nvidia/zai-org/glm-5.3` (C: `CLARITY_MODEL=…`), `REPO_ROOT` pointing at a dedicated `wt-<pr>-rev{A,C}` shared clone, and `REVIEW_RUN_DIR`/`CLARITY_RUN_DIR` under `/workspace/agent/runs/` ([429 IP rate-limit recovery + opencode dispatch recipe](../learnings/1794905724924-slang-pr-review-429-ip-rate-limit-recovery-opencod.md)). The claude-CLI fallback recipe also verified end-to-end again on #14534 r1 (A exit 0, drift 0, ~41 min API wall, ~$11; C exit 0): clear `NANOCLAW_MODEL_WEIGHTS` on the dispatch env, `--model nvidia/zai-org/glm-5.3`, and export `ANTHROPIC_DEFAULT_OPUS/SONNET/HAIKU_MODEL` + `ANTHROPIC_FALLBACK_MODEL` + `REPRO_PR_MODEL`/`CLARITY_MODEL` to the same id, awaiting each run with ONE `wait-run.sh --timeout 540` call ([dispatch recipe re-verified; diff-integrity hash lives in run.log](../learnings/1794908261506-pr-review-dispatch-recipe-re-verified-diff-integri.md)). PR #14549 was the second fully-clean sequential A→C run on this path; it also confirmed the shared-clone HEAD drift below is harmless and produced the `PolynomialIntVal` signed-overflow finding recorded on [[wiki/concepts/slang-language-core-integer-constant-folding.md]] ([PR #14549 review: clean sequential run; HEAD drift harmless](../learnings/1794925827959-pr-14549-review-clean-sequential-opencode-a-c-run-.md)).

## The 429 (CPE_RateLimit_IP): fleet-level, recover from the subagent outputs

During a `/slang-pr-review` on #14532 (small diff), the shared egress IP was rate-limited by inference-api.nvidia.com's WAF. Run A died at ~9 min (2/3 subagents done, REVIEW-GUARD FAIL); an immediate retry running ALONE (C already finished, no other local load) died the same way at ~15 min — so the limit is fleet/IP-level, not caused by A+C concurrency, and an immediate retry is likely wasted: **two failed attempts = stop retrying** ([429 recovery](../learnings/1794905724924-slang-pr-review-429-ip-rate-limit-recovery-opencod.md)). All three subagent reviews still complete verbatim in `<run_dir>/subagents/chatcmpl-tool-*.output` even though `final-review.md` is a <500 B stub: concatenate them into the combined report with a provenance header, mark the section "partial-but-complete-on-substance", set `"reviewers_complete":false` in the result JSON, and drift-check `tool-uses.jsonl` manually (grep matches for "POST/PR" are usually just subagent prompt text "do not post anything to GitHub" — inspect, don't count).

## Diff-integrity hash: read A's run.log, not slang/tmp

`/workspace/agent/slang/tmp/` is shared staging full of months of old artifacts, and Reviewer C's outer staging OVERWRITES `tmp/pr-diff.patch` after A's prestage with a differently-rendered copy (A staged a 12716-byte `gh pr diff` with sha256 `0fb87639…`; C's later 11215-byte file hashed `ba971a2c…`). Read the diff-integrity hash from A's `run.log` first line (the pre-stage JSON) and verify by sha256-summing an independently fetched `gh pr diff` against that value ([diff-integrity hash lives in run.log](../learnings/1794908261506-pr-review-dispatch-recipe-re-verified-diff-integri.md)).

**Verdict hygiene from the same runs:** LLM-subagent exact-encoding arithmetic is unreliable — four different value guesses for `FloatToHalf(0x7fa12345)` appeared across A/C reports (0x7F04/0x7F08/0x7F09/0x308); the correct set is 0x7fa12345→0x7F09, 0x7fc12345→0x7E08, 0x7fffffff→0x7FFF (fraction `0x212345>>13 = 0x109`). Verify any suggested exact test constant by hand before putting it in a verdict ([429 recovery](../learnings/1794905724924-slang-pr-review-429-ip-rate-limit-recovery-opencod.md)).

**Source learnings (3):**
- [slang-pr-review: 429 IP rate-limit recovery + opencode dispatch recipe](../learnings/1794905724924-slang-pr-review-429-ip-rate-limit-recovery-opencod.md) — fleet-IP limit; stop after two attempts; recover subagent outputs; verify exact constants by hand
- [PR-review dispatch recipe re-verified; diff-integrity hash lives in run.log, not slang/tmp](../learnings/1794908261506-pr-review-dispatch-recipe-re-verified-diff-integri.md) — C's staging overwrites tmp/pr-diff.patch; sha256 an independent gh pr diff against run.log
- [PR #14549 review: clean sequential opencode A→C run; shared slang HEAD drift is harmless](../learnings/1794925827959-pr-14549-review-clean-sequential-opencode-a-c-run-.md) — reviewers key off local master (merge-base), not HEAD; Devin first-fetch ~9 min

_Catalog: [[wiki/index.md]]_

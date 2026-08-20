---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787141580123-wwagq9
written_at: 2026-08-19T12:30:27.004Z
---

# [approver/infra-abstain] collect-reviews.sh drops head-current CodeRabbit summary posted as an issue comment (exit 20)

## Symptom
On shader-slang/slang PR #12618 (single-file `.github/workflows/nightly-remix-test.yml` change), `collect-reviews.sh --commit <head>` returned **exit 20** ("no harvestable bot review AND no bot still working") and wrote `harvest.json = {"found": false}`. That routed the workflow to the Devin-only tier — but a **head-current CodeRabbit review existed and was dropped**.

## Root cause
CodeRabbit does not always create a GitHub *review object*. On this PR its summary ("No actionable comments were generated 🎉", pre-merge checks ✅ 5 passed) was posted as a plain **issue comment** on the PR (`gh pr view N --json comments`, author `coderabbitai`), with the reviewed range embedded in the body ("between <base> and <head>"). `collect-reviews.sh` (~line 171, the no-review-object branch) exits 20 *before* persisting any CodeRabbit issue-comment summary, so a genuinely-clean head-current secondary review is silently discarded. The production `Claude Code Assistant` check-run is legitimately `skipped` on CI-only PRs, so exit 20's "no primary" half was correct — but the "no secondary" half was wrong.

## How to catch it
Before accepting a `collect-reviews.sh` exit 20 / `found:false`, independently check `gh pr view <pr> --repo <repo> --json comments --jq '.comments[]|select(.author.login=="coderabbitai")'`. If a CodeRabbit summary comment exists, read its embedded commit range ("between <base> and <head>") — if `<head>` == the pinned head, it is a valid head-current secondary source; incorporate its body into the synthesized review doc and classify the tier as fallback (CodeRabbit-summary + Devin), not Devin-only. This does not change a clean verdict but it makes the derivation complete, and it matters when CodeRabbit *does* flag something.

## Fix
Two layers: (1) at decision time, always cross-check `--json comments` for a `coderabbitai` summary when the collector reports no review object; (2) collector-side (owner: skill maintainer), persist `coderabbit-review.md` from the issue-comment summary before the exit-20 return so the schema stays honest. This was caught by the DECISION_REVIEW codex critique, not by the collector — a reminder that exit 20's negative branch is reached by fall-through and must be independently probed (cf. "a negative branch reached by fall-through is the least trustworthy result").

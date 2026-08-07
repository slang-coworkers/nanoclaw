---
title: "slang priority-yield aging is CONTENTION-gated, not a timer — a yielded run can expire unrerun"
type: learning
topic: slang-compiler
source: learnings/1786079520646-slang-priority-yield-aging-is-contention-gated-not.md
---

# slang priority-yield aging is CONTENTION-gated, not a timer — a yielded run can expire unrerun

The widely-repeated belief "aging (`retry-yielded-bot-ci`, ≤~8h) will force-run a yielded bot CI into a real verdict" is **false as a timer**. Measured 2026-08-07 against run `31127594595` (`fix/issue-12401`).

**The machine (two scripts, one hard dependency):**
1. `extras/ci/wait-for-priority.py --max-yield-hours 12` escalates only when the gate **runs again** and finds itself aged ≥12h (age from *original* creation, across reruns). A completed, yielded run does **not** escalate itself while sitting still.
2. Escalation therefore requires a **rerun**, and reruns come only from `.github/workflows/ci-retry-yielded-bot.yml` → `extras/ci/retry-yielded-bot-ci.py`.
3. That script's **first gate** is `any_active_ci(...)`: if **any** `ci.yml` run repo-wide is `queued|in_progress|waiting` it prints `CI is still active (N run(s)); not rerunning bot CI.` and exits 0. Then `--max-reruns 1` — one rerun per fire, ordered by ascending `run_number`.

**Real params are 12h yield-out / 16h lookback, not "~8h".** Past the 16h lookback a run silently stops being a candidate: it **expires unrerun**, it does not escalate.

**Measured on a busy day:** 60/60 aging fires over 5.4h were blocked at gate 1 — zero found CI quiet, zero reran anything. 32 in-window bot `workflow_dispatch` failure/cancelled candidates competed for 1 slot per fire; the run of interest was 9th.

**How to check (don't re-derive):**
- The falsifying command is the aging run's **own decision line** — its conclusion is `success` even when it did nothing, and a GHA log echoes its own script, so grep the **output**, not the echoed `run:` block:
  `gh run view <id> -R <repo> --log | grep -oE "CI is still active.*|No yielded bot CI runs are eligible.*|Rerunning yielded bot CI run #[0-9]+.*"`
- A rerun **mutates the same run id in place** ⇒ `run_attempt` is the test for "did aging touch this run"; `head_sha` is unchanged, so never hunt for a *new* run id at the same SHA.
- Don't misread a long-lived active run as stranded (which would imply the gate never opens): a bot run `in_progress` for 12.8h had 26 jobs completed / 9 `in_progress` started minutes earlier — genuinely working. Key on **`status`**, never `started_at`.

**Reporting rule:** never promise "aging will force it through by <time>". Report the gate state — is `ci.yml` quiet, and what is this run's queue position among candidates. Under sustained contention the honest answer is "may expire at the 16h lookback without ever building". Corollary: re-dispatching CI on a draft under contention just mints another yield and another competitor for the single slot.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786079520646-slang-priority-yield-aging-is-contention-gated-not.md`_

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786499523694-gcjjz6
written_at: 2026-08-12T13:02:51.962Z
---

# [approver/human-disagreement] BLOCK ran hot on ci_health.py #12481 — probe DEPLOYED-path reachability before treating a Devin 🔴 in an internal tool as blocking

**Outcome (slang#12481 @6979ee468aeb).** I decided **BLOCK** (RED_BUG
`ci_health.py:1412`: new PR-link cells hard-code
`github.com/shader-slang/slang/pull/{n}` though the tool takes `--repo`).
The author/owner (jkiviluoto-nv) **merged it unchanged at my exact decided head**
(single commit, no interval fix, mergeCommit `21cfd0e3`, 12:58:41Z). merged ⇒
APPROVED-equivalent ⇒ my BLOCK **DISAGREED** with the human.

**Root cause of the miss — I let a Devin 🔴 marker be dispositive without probing
whether the trigger is reachable on the DEPLOYED path.** The 🔴 is a real code
defect (it diverges from the file's own `:444` convention `f".../{repo}/pull/…"`),
and I verified *that* three ways. But I never asked the reachability question. The
ONLY invocation of `ci_health.py` in the whole repo is `.github/workflows/ci-health.yml:55`:
`python3 extras/ci/analytics/ci_health.py --output ci_analytics_repo` — **no `--repo`
argument**. So the tool ALWAYS runs against `DEFAULT_REPO = "shader-slang/slang"`,
which is exactly the value the link hard-codes. The `--repo` flag is a defaulted CLI
option that no caller ever sets to a non-default value ⇒ the flag-dependent branch is
**dead on the supported path**, and the "wrong-repo link" can never occur in the
deployment.

**The rule this violates was already in the skill.** Step-3 gap-severity says a gap
CLEARS (advisory, does not block) when "the trigger [is] unreachable on the supported
path." That carve-out applies to a Devin 🔴 too — a 🔴 severity marker is the
reviewer's PRIOR, not my verdict; the challenger must verify severity, not just
existence. Existence-verified ≠ reachability-verified.

**How to catch it next time (transferable).** When a 🔴 in an internal / CLI tool
depends on a **configurable parameter** (a `--flag`, an env var, a `DEFAULT_*` with an
override), before treating it as blocking, grep the repo for how the tool is actually
**invoked** (`.github/workflows/**`, scripts, cron): does any caller ever supply a
non-default value? If the only deployed invocation uses the default — where the
hard-coded / assumed value is correct — the defect is a latent maintainability 🟡
(clears advisory: "trigger unreachable on the supported path"), not a live 🔴. The
one-command probe: `grep -rn "<toolname>" .github/workflows/ scripts/ | grep -- "--<flag>"`.

**Precedent / pattern — SECOND ci_health.py BLOCK that the human overruled** (cf.
[[pr-12427-decided]] @375826c6, RED_BUG `:1420` esc-in-`.catch`, human APPROVED there
too). BUT note the DISCRIMINATOR that separates them: #12427's bug (a `ReferenceError`
on any fetch failure) WAS reachable on the deployed path — that BLOCK was defensible on
reachability and the disagreement is about whether panel-stuck-loading is
merge-blocking. #12481's bug is NOT reachable on the deployed path — that is the
weaker BLOCK. ⇒ Don't lump them as "I run hot on ci-analytics"; the specific lesson is
**reachability-probe the deployed invocation for parameter-dependent findings.** Both
were first-drafted WOULD_APPROVE then reversed UP to BLOCK by DECISION_REVIEW — the
critique gate pushed toward stricter on both, and on #12481 that was the wrong
direction. Reversing toward stricter is not automatically safer when the strictness
rests on an unprobed trigger.

---
title: "Critique Gate and Decision Recording"
type: concept
group: review-process
tags: [critique-gate, record-decision, fails-open, fails-closed, human-agreement, approver, codex, verdict, delivery-gate, workflow-state, false-abstain, published-vs-local]
source_count: 14
---

# Critique Gate and Decision Recording

The `critique-gate` overlay blocks side-effecting calls via a PreToolUse hook (`gate-critique-on-deliver.sh`) until a PostToolUse hook (`track-critique.sh`) has recorded enough approving codex rounds in `/workspace/.claude/workflow-state.json`. This page covers the gate as an instrument and what the downstream recording (`record_decision` → `approval_decisions` → the human-agreement join) is for. Clause order, verdict tiers and gate satisfaction live in [PR-Approver: Decision Procedure](../concepts/review-approver-decision-procedure.md); calibration in [PR-Approver: Challenger Calibration](../concepts/review-approver-challenger-calibration.md); reviewer mechanics in [PR Review Practices](../concepts/review-pr-practices.md).

## TL;DR

- A gate's denial is a claim. Before spending a round satisfying a block, ask what the gate measured versus what you need to know (did the reviewed artifact change?).
- Input-side defects fail closed: the Bash pattern is verb-blind (a read-only `gh api .../pulls/<n>` GET is denied as "PR creation"), it scans literal command text (a heredoc quoting a trigger trips it), `edits_since_critique` is container-wide, and a missing `/workspace/.claude/` blocks every call.
- A PR is an issue: `gh api repos/O/R/issues/<n>` serves the same `body`/`labels`/`state`/`author_association` and passes the gate, as do `gh pr view --json` and `gh pr diff`. Author files that quote triggers with the Write tool.
- Whether an approve still binds is answered by re-hashing `.critique_attested.OUTPUT_REVIEW`, not by the edit counter. `### Attested` re-hashes at send, so editing after an approve denies delivery.
- Only a fresh `mcp__codex__codex` call with a `STAGE:` tag and the verbatim `/codex-critique` developer-instructions counts as a round; `codex-reply` and freeform calls are never recorded.
- The verdict recorder fails OPEN: an MCP-array `tool_response` parses to empty and the guarded write keeps the previous value, so a stale `approve` survives a `must-fix`. Read codex's own `### Verdict`; a never-changing or session-inherited verdict is the tell.
- Audit any control by asking what it records when it cannot tell; "the previous answer" means it fails open. Fails-closed defects cost friction; fails-open defects ship must-fixes.
- The gate keys off delivery markers (`[Resolution]`, `[Report]`, `[Review Verdict]`), not diffs: a no-code close still needs every required stage plus `OUTPUT_REVIEW=approve`.
- Abstain `[Approval Decision]` text must avoid whole-word uppercase `BLOCK`/`WOULD_APPROVE` or the abstain fast-path is skipped; every delivery-marker send needs `in_reply_to`.
- A gate-denied side-effecting call is an OUTSTANDING ACTION: satisfying the gate is not the delivery. Write down the retry, then verify the PUBLISHED copy by re-fetching and diffing, never by grepping your local file.
- When a reviewer's report contradicts your local measurement, suspect the delivery path. Diff content; never reconcile by length.
- Bypass after deny ×3 is a human dashboard approval (`critique_gate_bypass` in `pending_approvals`); `ncl approvals` is list/get only. A gate-blocked coworker must open a draft PR or escalate promptly, and a draft PR skips CI.
- The gate can must-fix an INPUT the approver cannot edit (PR-author comment style). Accept its factual catches, hold the scope line, label an unresolvable soft-cap ESCALATED (not CHALLENGER_CONCERN, not a silent WOULD_APPROVE).
- DECISION_REVIEW can flip a verdict on the merits: a fix enabling a multi-arm branch needs a test per arm. Universal ("all"/"never") rationale claims need whole-file evidence.
- Score a join off `head.sha`, never git ancestry, in a squash-only repo; a formal `APPROVED` review at the decided commit beats a bare merge.
- An averted false-abstain or correctly declined check leaves no error signal; record it at join time. A correct procedure on a misclassified input fails silently.
- An advisory the humans declined to act on is as informative as one they acted on; pre-commit to "if this merges unchanged, what does that tell me?"
- Bot-authored comments and merge-queue evictions on a head that never moved are correct no-ops.

## The gate is two instruments that fail in opposite directions

On the input side, `gate-critique-on-deliver.sh` decides whether a call is a delivery and errs by over-including. On the output side, `track-critique.sh` decides what codex said and errs by under-recording, silently keeping a previous approval when it cannot parse the current verdict. The first costs rounds; the second lets a must-fix ship. After several bogus denials an `OUTPUT_REVIEW=approve` reads as the instrument finally agreeing, but it has a known parse defect on exactly that field. Every other critique-gate defect (over-blocking reads, an unreachable escalation path, a fresh session born already-denied by the workspace-scoped counter) fails closed; the verdict recorder fails open ([the critique-gate verdict recorder fails OPEN](../learnings/1785989503064-the-critique-gate-verdict-recorder-fails-open-a-mu.md)).

## Input side: fails-closed false positives

Modes 1–3 were measured on slang PR #12378; all cost real rounds and none indicated a genuine problem ([critique-gate false positives — GET vs POST, container-wide counter, command text](../learnings/1785992478312-critique-gate-false-positives-it-cannot-tell-a-get.md)).

**1. The pattern is verb-blind.** `gate-critique-on-deliver.sh:52` is

```
BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'
```

a substring match with no notion of HTTP method, so the read-only `gh api repos/O/R/pulls/<n> --jq '.body'` you run to verify a posted body is denied as PR creation. Because a PR is an issue, `gh api repos/O/R/issues/<n> --jq '.body'` returns the same `body`, `labels` and `state` over a path with no `pulls`: both the workaround and the correct verification fetch.

**2. It scans command text, not effect.** A `python3 - <<'PY' … PY` saving a memory note was denied because the saved prose mentioned `gh api … pulls`. Author such files with the Write tool, then run a bare `python3 script.py`.

**3. `edits_since_critique` is container-wide.** The gate reported *"1 edit recorded since the last critique — the approve no longer covers the current state"* when no reviewed artifact had changed; the edit came from a peer session in worktree `wt-slang-12371` in the same container. The counter is container-global while the approve is per-session. The attested-hash set answers "did my reviewed artifact change?":

```bash
STATE=/workspace/.claude/workflow-state.json
jq -r '(.critique_attested//{}).OUTPUT_REVIEW//{}|keys[]' "$STATE" | while read -r p; do sha256sum "$p"; done
# compare against the recorded hashes:
jq -r '(.critique_attested//{}).OUTPUT_REVIEW//{}|to_entries[]|"\(.value)  \(.key)"' "$STATE"
```

All hashes matching means the approve still binds, whatever the counter says: re-hash before you re-review (the same family as the container-scoped-paths trap).

**4. A missing state directory blocks everything.** When `/workspace/.claude/` does not exist, the hook's `> "$STATE.tmp"` write fails (`line 417: /workspace/.claude/workflow-state.json.tmp: No such file or directory`), the hook exits non-zero, and the call is blocked whatever it was, with the gate message printed anyway. On slang#12924 a read-only `gh api repos/.../pulls/12924` was denied for both this reason and mode 1. Mitigations that do not weaken the gate (empty state still denies real deliveries): `mkdir -p /workspace/.claude` at session start, and read metadata via `gh pr view --json …`, `gh pr diff <n>`, or `gh api repos/O/R/issues/<n> --jq .author_association`. Skill scripts (`collect-reviews.sh`, `eval-clauses.py`) hide their inner `gh api .../pulls` because the hook inspects only the top-level command string ([critique-gate hook blocks read-only `gh api .../pulls` and fails closed when `/workspace/.claude/` is missing](../learnings/1788945661953-approver-tooling-critique-gate-hook-blocks-read-on.md)).

**What counts as a round.** A recorded round must be a fresh `mcp__codex__codex` call. `codex-reply` carries no `developer-instructions`, so `track-critique.sh` cannot verify the canonical sentinel block and refuses to record the round; re-issue each round as a fresh call with the verbatim `/codex-critique` developer-instructions. Codex also nits a new item every round, so the "3 rounds → stop, escalate" rule is real ([SlangPy PR review: codex-reply rounds don't count toward the gate](../learnings/1789486053134-slangpy-pr-review-pin-to-explicit-shas-shared-chec.md)). A round also needs a `STAGE:` tag; a freeform call without it logs "stages: none" and does nothing. The gate binds by content: the `### Attested` sha256 is re-hashed at send, so editing after an approve denies delivery until a fresh round re-attests. Any verdict-bearing chain-close (`[Resolution]`/`[Review Verdict]`) fires a `[GATE AUDIT]` demanding every required stage ≥1 plus `OUTPUT_REVIEW=approve`, even for a no-code close ([critique-gate counts only codex calls in the exact format; `### Attested` re-hashes at send](../learnings/1790016287155-critique-gate-resolution-pr-delivery-only-counts-c.md), [verdict-bearing chain-close messages trip the critique-gate](../learnings/1790042386094-verdict-bearing-chain-close-messages-resolution-re.md)).

**Two hooks bite an abstain `[Approval Decision]` delivery.** First, `gate-critique-on-deliver.sh:98-103` has an abstain fast-path that allows delivery without a recorded round only when the text contains `ABSTAIN_POLICY`/`ABSTAIN_INFRA` and does not match the case-sensitive `\b(WOULD_APPROVE|BLOCK)\b`. A rationale such as "**Not BLOCK** (code is correct)" skips the fast-path and the full gate denies, burning a `critique_gate_denials` strike (soft cap 3); phrase rationales as "not a code-defect rejection" or lowercase "blocking". Second, `gate-chain-routing.sh` requires `in_reply_to` on any `send_message` carrying a delivery marker (`[Approval Decision]`, `[Resolution]`, `[handoff]`), even to a dashboard destination, and this still applies on the `ABSTAIN_POLICY` path where the host relaxes the delivery gate. Set `in_reply_to=<tasking inbound id>` (thread_id derives from it) and keep the explicit `to=` ([abstain `[Approval Decision]`: avoid whole-word BLOCK/WOULD_APPROVE and always set in_reply_to](../learnings/1789057110525-approver-infra-abstain-approval-decision-abstain-m.md)).

## The gate is code-blind: no-code closes still need every stage

By design the gate keys off delivery markers (`[Resolution]`, `[Report]`) in outbound text, not off whether code was written, so a zero-diff triage-confirmation is blocked until PLAN_REVIEW, CODE_REVIEW and OUTPUT_REVIEW (`approve`) are recorded; the gate cannot be told the task was code-free. Satisfy it honestly: write the deliverable (verification log plus approaches considered) to a file, then run `/codex-critique` per stage. PLAN_REVIEW checks the no-code approach and that the blocker is real; CODE_REVIEW points at `git status --porcelain` + `git diff --stat` to confirm the zero diff is correct and no in-scope fix was dropped; OUTPUT_REVIEW covers the report. Each call uses the verbatim developer-instructions and `sandbox: "danger-full-access"`; once the file exists the three stages can run as parallel tool calls ([the critique gate fires on no-code triage-confirmations](../learnings/1783523465568-critique-gate-fires-on-no-code-triage-confirmation.md)).

## Output side: the verdict recorder fails OPEN

Neither `critique_verdicts[STAGE]` in the workflow-state file nor the `Critique round N recorded (… verdicts: …)` PostToolUse notice is trustworthy; the `### Verdict` section codex actually returned is the source of truth. On shader-slang/slang#12089 (2026-08-06) codex returned `must-fix` on three consecutive `OUTPUT_REVIEW` rounds and the hook printed `OUTPUT_REVIEW=approve` every time ([the critique-gate verdict recorder fails OPEN](../learnings/1785989503064-the-critique-gate-verdict-recorder-fails-open-a-mu.md)). The mechanism in `track-critique.sh` turns on the shape of `tool_response`:

| `tool_response` shape | parsed `RAW_VERDICT` | recorded |
|---|---|---|
| `{content: [{type:"text", text:"### Verdict\nmust-fix…"}]}` — the **MCP array** | *(empty)* | `""` |
| `{threadId:…, content:"### Verdict\nmust-fix…"}` — the shape the hook's own comment documents | `must-fix` | `must-fix` |

1. `:68-72` runs `jq -r '.content'` assuming string-or-object; an array renders as JSON text (`[ { "type": "text", …`), so the `:80-91` awk match on `^###[ \t]*verdict` never fires.
2. The writes at `:183` / `:196` / `:205` are each guarded `if $v != "" then … else . end`, so an empty parse preserves the previous value instead of recording "unknown", and the delivery gate reads `OUTPUT_REVIEW=approve`.
3. The `:96` `*) VERDICT="unparseable"` arm, which exists so the gate fails closed on a bad verdict line, is unreachable on this path because the failure yields `""`, not garbage.

The hook's header notes this defect class was fixed once before (*"45% of June must-fix verdicts were lost that way, and a lost must-fix downgrades the delivery gate to count-only"*), with a different input shape. On #12089, reading codex directly is the only reason a public comment with a false claim ("the patch is below the fold") never shipped to a maintainer's PR. Tells: a verdict that never changes across rounds that returned must-fix items, and a stale `approve` inherited from a previous session (the state file is workspace-scoped).

## A gate-blocked delivery is an outstanding action

On slang PR #12378 a reviewer reported the same stale figure (`742/742`) in the PR body for eight consecutive rounds. Each round it was fixed locally and reported fixed; `grep -c '742/742'` on the local artifact returned 0, yet the posted body was byte-identical to a version from eight rounds earlier. Both parties were right: the corrections were real and never delivered ([a fix to your local artifact is not a fix to the published copy](../learnings/1785992450842-a-fix-to-your-local-artifact-is-not-a-fix-to-the-p.md)). The loop: reviewer reports → edit local artifact → `gh` body update → hook denies → satisfy the gate (fix, re-critique, approve) → never return to the update. Satisfying the gate feels like completing the work because it ends in an approval, and to the reader "corrected but undelivered" is indistinguishable from "never corrected".

Rules: write down the retry of every gate-denied call; verify the published copy by re-fetch and diff; when a reviewer contradicts your local measurement, suspect the delivery path (two honest measurements of two objects); diff content, never reconcile by count — one body legitimately had three correct lengths (22,220 bytes / 22,093 Unicode chars / 22,092 API-reported). The check uses the gate-safe issues endpoint:

```bash
gh api repos/O/R/issues/<n> --jq '.body' > /tmp/live.txt   # PR bodies are served here too
tr -d '\r' < /tmp/live.txt | sed -e '$ { /^$/d }' > /tmp/live-norm.txt
diff /tmp/live-norm.txt ./local-body.md && echo "PUBLISHED == LOCAL"
```

It strips CR (GitHub returns CRLF) and the trailing newline that `jq -r` adds before diffing.

**Hard-block escalation is a human approval, not an orchestrator action.** When the gate hard-blocks a coworker's `gh pr create` on a must-fix it cannot satisfy in place, escalation is graduated: on the third deny the host auto-creates a `critique_gate_bypass` row in `pending_approvals` routed to `dashboard-admin` (Approve / Reject / Reject-with-reason). `ncl approvals` is list/get only, so even a global-scope orchestrator cannot flip the grant, by design. On a human Approve, the host-sweep plus `src/modules/critique-escalation/` writes `critique_gate_bypass_approved=true` and the coworker's `gh pr create` fires on its own. The orchestrator locates the live card (`ncl approvals list`, match `action=critique_gate_bypass` and the issue thread) and hands the operator the `approval_id` with a recommendation; it never tells the blocked coworker "proceed now". Reject routes the coworker to its pre-agreed clean path. A gate-blocked coworker must open a draft-held PR or escalate promptly, never silently stand by: slang#12622 idled about 13 days until the reporter asked "where's the PR" (supervisor heuristic: pushed branch + no PR + age > N days → nudge). A draft PR is the safe release valve but skips CI: a draft is not auto-merged, `Fixes #<n>` does not auto-close from it, and `ci.yml` filters `draft != true`, so a green-looking draft is not CI-verified ([critique-gate bypass is a human dashboard approval; draft-PR is the release valve](../learnings/1789272925575-critique-gate-bypass-is-a-human-dashboard-approval.md)).

## Gate-scope error: a must-fix on an input the approver cannot edit

On shader-slang/slang#12453 @425c2a95 the DECISION_REVIEW gate held must-fix across all three rounds (soft cap), demanding WOULD_APPROVE → ABSTAIN. After every factual catch was fixed, its sole surviving objection was that two PR-author comments narrate change-history or a rejected alternative (`m_suppressConsoleOutput` "fd-redirection was tried, not portable on Windows"; a unit-test comment "This is not hypothetical: … failed"). That is a gate-scope error: the codex developer-instructions carry a generic comment-hygiene rule scoped "when a code diff is under review", but in the approver the diff is untrusted input rather than the agent's own work product, and the approver is read-only, so the only remedy (revise the comments) is impossible. The rule also conflicts with shader-slang/slang's own CLAUDE.md, which prescribes conversational, concrete-incident comments (literally "This is not hypothetical:"); the production reviewer (github-actions[bot]) did not flag them, and a human (jkiviluoto-nv) had already APPROVED the exact head.

Three disciplines follow. WOULD_APPROVE coexists with acknowledged clarity nits: the enum has no approve-with-nits state, and a comment-style nit clears the conservative-lean rubric (zero trigger reachability, coverage impact and blast radius; comments do not execute). Every factual catch is still accepted: on #12453 codex correctly caught an "only one untested change" miscount, wrong audit-trail line numbers, a CI-green-as-coverage overstatement, and a false "already counted" claim. And the mechanical trap: the host gate blocks recording WOULD_APPROVE/BLOCK without a critique `approve` but is relaxed for ABSTAIN_\*, so a stubborn must-fix on an unfixable input leaves only abstains recordable. An unresolved soft-cap escalates to a human and never silently passes, so the honest label is ESCALATED (a gate/approver deadlock), not CHALLENGER_CONCERN and not a silent WOULD_APPROVE; the human APPROVE at head is the falsifiable proof the abstain was gate-induced. The durable fix is an approver-context carve-out exempting PR-author comment style in the input diff from DECISION/OUTPUT_REVIEW must-fix; until then, escalate as ESCALATED and flag the over-application ([critique gate over-applies generic comment-hygiene to un-editable PR-author comments → false ESCALATE](../learnings/1786490730776-approver-critique-mustfix-critique-gate-over-appli.md)).

## DECISION_REVIEW earns its keep, on the verdict and on the rationale

On slang#12892 R2 (a parser fix restoring a generic member-call path) DECISION_REVIEW produced this group's first recorded decision flip on the merits rather than a clause artifact. The 6-line fix enables a branch with two accepting arms (`checkedBase` a single `DeclRefExpr` vs an `OverloadedExpr`), the one new test exercised only the `OverloadedExpr` arm, and a corpus search found no pre-existing `->` generic-member-call test, so WOULD_APPROVE became ABSTAIN_POLICY:OPEN_GAP. An untested arm is not cleared by shared-machinery analogy ([a fix that enables a multi-arm branch needs a test per arm](../learnings/1789066986411-approver-critique-mustfix-a-fix-that-enables-a-mul.md)). On the trivial slang#12993 test-only cleanup (verdict correctly unchanged) it returned must-fix twice on rationale accuracy: "all argument access goes through the bounds-checked `get(i)`" came from a `grep … | head -40` on a 1067-line file and was false (a direct `args[0]` at line 1059). Before any universal ("all"/"never"/"cannot") claim, run `wc -l` and grep the whole file; scope claims to what was verified ("unreferenced at head, full-file grep, + green CI") and name which UB on which path ([universal safety claims need whole-function evidence, not a truncated grep](../learnings/1789058775886-approver-critique-mustfix-universal-safety-claims-.md)).

## What the recording is for: the human-agreement join

Everything above serves one artifact: a `record_decision` row in the `approval_decisions` ledger, pinned to a commit, that is later scored against what the humans did. shader-slang/slang#12322 ("slang-test: gate `-emit-cpu-via-llvm` tests on LLVM backend availability"), decided `WOULD_APPROVE` / `CLEAN` at `ba156ebf5c900ff89189c15347bafded7b4280ee` on 2026-08-04 and joined 2026-08-06, is the worked example ([approver human-agreement join — slang#12322 merged and formally APPROVED at the decided SHA](../learnings/1785987292855-approver-human-agreement-slang-12322-joined-merged.md)).

- It merged by `jkwak-work` at the exact decided head, scored off `pulls/<n>.head.sha == ba156ebf5c90` and never git ancestry: the repo is squash-only, so `merge_commit_sha=e82a9317147f` carries no ancestry link and `merge-base --is-ancestor` returns an authoritative-looking false negative.
- A formal `APPROVED` review at that commit (`jkwak-work`, 2026-08-04T22:50:28Z, the maintainer whose earlier `COMMENTED` review drove a helper's removal) is an explicit approval of the identical artifact, stronger than inference from a merge.
- Final diff +17/−2, one file, six commits, none after the decided head: clean agreement.

## Averted false-abstains and declined checks leave no error signal

The load-bearing half of #12322 is which judgement the agreement vindicated. The PR had the surface shape of "new flag + new gate", which triggers a standing 4-step dead-flag probe (setter / order / jobs-not-passes / trigger-present control) whose own rule mandates `ABSTAIN_POLICY:OPEN_GAP` absent the control. The probe was declined because the input failed its precondition: the gate (`_canIgnore`, `tools/slang-test/slang-test-main.cpp:4940-4944`) and the flag bit (`SLANG_PASS_THROUGH_LLVM`) both pre-existed, only two new writers were added (`:1531`, `:4656`), and `addUsedBackEnd` (`tools/slang-test/test-context.h:55-62`) is a pure OR with no clearing site and exactly one reader. It is therefore monotone: a test can move running→`Ignored`, never back and never →`Fail`. The merge plus approval confirms the call; demanding a trigger-present control would have false-abstained a formally approved PR.

Had the abstain been recorded, the PR would have merged looking exactly as fine, and "abstain" reads as caution whether or not it was warranted. Only the counterfactual (what would my procedure have produced, and did the human disagree?) exposes it, so a join where a standing check was declined records that declining was right; otherwise only acted-on decisions get scored. A correct procedure applied to a misclassified input yields a false result with no error signal — the gate's GET-as-PR-creation error, one level up.

The second resolved prediction is a negative calibration datapoint: the PR description's §3 still promised a helper (`_addForcedBackendRequirements`) removed at the maintainer's request; it was raised as an advisory, never synced, and the maintainer approved anyway. Doc-vs-diff drift of this kind is a real nit but not approval-blocking for this repo: keep it advisory, never `OPEN_GAP`.

## Checks that correctly do not fire

`nv-slang-bot[bot]` commented 2026-08-05T02:14:48Z that #12322 had been evicted from the merge queue at 2026-08-05T00:09:14Z (`reason: failed_checks`) by the tracked Falcor flake #12145 (`test_GBufferRTTexGrads_d3d12`, `0xC0000005` access violation). It was non-causal (the diff is a slang-test harness file not linked into `Mogwai.exe`), head stayed green, and the PR merged. It was a no-op for two independent reasons: the comment is bot-authored (not a routing inbound), and the head never moved (no new revision, no re-gate). A combined-status failure from a non-causal flake is not a blocker.

---
**Source learnings (14):**
- [critique-gate counts only exact-format codex calls; `### Attested` re-hashes at send](../learnings/1790016287155-critique-gate-resolution-pr-delivery-only-counts-c.md) — STAGE tag + verbatim instructions.
- [verdict-bearing chain-close messages trip the critique-gate `[GATE AUDIT]`](../learnings/1790042386094-verdict-bearing-chain-close-messages-resolution-re.md) — all stages ≥1 + OUTPUT_REVIEW=approve.
- [abstain `[Approval Decision]`: avoid whole-word BLOCK/WOULD_APPROVE; set in_reply_to](../learnings/1789057110525-approver-infra-abstain-approval-decision-abstain-m.md) — fast-path skip; `gate-chain-routing.sh` needs `in_reply_to`.
- [a fix enabling a multi-arm branch needs a test per arm](../learnings/1789066986411-approver-critique-mustfix-a-fix-that-enables-a-mul.md) — slang#12892, first flip on the merits.
- [universal rationale claims need whole-function evidence](../learnings/1789058775886-approver-critique-mustfix-universal-safety-claims-.md) — not a `grep|head` slice.
- [critique-gate false positives: GET vs POST, container-wide counter, command text](../learnings/1785992478312-critique-gate-false-positives-it-cannot-tell-a-get.md) — re-hash the attested set before re-reviewing.
- [the critique-gate verdict recorder fails OPEN](../learnings/1785989503064-the-critique-gate-verdict-recorder-fails-open-a-mu.md) — empty parse keeps the previous verdict.
- [a fix to your local artifact is not a fix to the published copy](../learnings/1785992450842-a-fix-to-your-local-artifact-is-not-a-fix-to-the-p.md) — a gate-blocked delivery is outstanding; re-fetch and diff.
- [slang#12322 joined MERGED + formally APPROVED at the decided SHA](../learnings/1785987292855-approver-human-agreement-slang-12322-joined-merged.md) — score off `head.sha`; record declined checks.
- [the critique gate fires on no-code triage-confirmations](../learnings/1783523465568-critique-gate-fires-on-no-code-triage-confirmation.md) — keys off delivery markers, not diffs; all three stages needed.
- [critique gate over-applies comment-hygiene to un-editable PR-author comments](../learnings/1786490730776-approver-critique-mustfix-critique-gate-over-appli.md) — slang#12453; accept factual catches, label ESCALATED.
- [critique-gate hook blocks read-only `gh api .../pulls`; fails closed without `/workspace/.claude/`](../learnings/1788945661953-approver-tooling-critique-gate-hook-blocks-read-on.md) — `mkdir -p`; read via `gh pr view`/`issues`.
- [critique-gate bypass is a human dashboard approval; draft-PR is the release valve](../learnings/1789272925575-critique-gate-bypass-is-a-human-dashboard-approval.md) — deny ×3 → `critique_gate_bypass`; a draft skips CI.
- [SlangPy PR review: codex-reply rounds don't count; pin reviews to explicit SHAs](../learnings/1789486053134-slangpy-pr-review-pin-to-explicit-shas-shared-chec.md) — re-issue each round as a fresh `mcp__codex__codex`.

_Catalog: [[wiki/index.md]]_

---
title: "Critique Gate and Decision Recording"
type: concept
group: review-process
tags: [critique-gate, record-decision, fails-open, fails-closed, human-agreement, approver, codex, verdict, delivery-gate, workflow-state, false-abstain, published-vs-local]
source_count: 33
---

# Critique Gate and Decision Recording

## TL;DR

- A gate's denial is a claim: before spending a round on a block, ask what it measured versus what you need to know (did the reviewed artifact change?).
- Input-side defects fail closed: the Bash pattern is verb-blind (a read-only `gh api .../pulls/<n>` is "PR creation") and scans literal command text, `edits_since_critique` is container-wide, and a missing `/workspace/.claude/` blocks every call. Read via `gh api repos/O/R/issues/<n>` or `gh pr view --json`.
- Whether an approve still binds is answered by re-hashing `.critique_attested.OUTPUT_REVIEW`, not by the counter. Write artifacts before the final round; the comment gate matches Attested entries by absolute path.
- A round is a fresh `mcp__codex__codex` call with a `STAGE:` tag, the verbatim `/codex-critique` developer-instructions, and `REQUIREMENTS: none — <reason>` or a multi-line `R<n>. "<verbatim quote>" — <comment URL>` list. A `STAGE:` `codex-reply`, a freeform call or a one-line summary is not recorded.
- The verdict recorder fails OPEN: an unparsed reply keeps the stage's previous value, so a stale `approve` survives a `must-fix`, and a non-review (recall bullets, empty) is recorded `approve` when the stage had one. No `### Verdict` / `### Attested` in codex's own output means no review: re-ask and post nothing until one arrives.
- Recall stubs come from codex running the `AGENTS.md` recall rule in `cwd: /workspace/agent`: set `cwd` outside it and open with "Do NOT run a wiki or learnings recall — perform the review below directly and return only the structured output".
- A `codex-reply` updates the stage only when its thread was mapped at the initial call, and `### Attested` lines parse only as plain `- <sha256> <absolute path>`. After any reply-recovered round, read `.critique_verdicts` and `.critique_attested` before delivering.
- Verdicts persist per stage in `workflow-state.json` across phases: a session revived months later is blocked by its old `must-fix`, even on reads, until fresh rounds run.
- Audit any control by asking what it records when it cannot tell; "the previous answer" means it fails open.
- The gate keys off delivery markers (`[Resolution]`, `[Report]`, `[Review Verdict]`), not diffs: a no-code close still needs every stage plus `OUTPUT_REVIEW=approve`. Marker sends need `in_reply_to`; abstain text avoids whole-word uppercase `BLOCK`/`WOULD_APPROVE`.
- The upstream five-part PR body cannot pass the description gate (≤1000 chars, ≤2 lines per section): the Process report goes in the explain-diff-html comment; tell codex up front.
- A gate-denied side-effecting call is an OUTSTANDING ACTION: write down the retry and verify the PUBLISHED copy by re-fetch and diff, never by grepping your local file or comparing lengths.
- Bypass after deny ×3 is a human dashboard approval (`critique_gate_bypass`); `ncl approvals` is list/get only. A gate-blocked coworker opens a draft PR (which skips CI) or escalates promptly.
- A must-fix on an input the approver cannot edit (PR-author comment style) is a gate-scope error: accept the factual catches, hold the scope line, label it ESCALATED. Codex also must-fixes its own `disabled://` sandbox; say so in the WHY.
- DECISION_REVIEW can flip a verdict on the merits (a multi-arm branch needs a test per arm); universal ("all"/"never") claims need whole-file evidence.
- Score a join off `head.sha`, never git ancestry, in a squash-only repo; a formal `APPROVED` at the decided commit beats a merge. Averted false-abstains and correctly declined checks leave no error signal: record them at join time. Bot comments and evictions on an unmoved head are no-ops.

## Overview

The `critique-gate` overlay blocks side-effecting calls via a PreToolUse hook (`gate-critique-on-deliver.sh`) until a PostToolUse hook (`track-critique.sh`) has recorded approving codex rounds in `/workspace/.claude/workflow-state.json`. Recipes: stage counting, attestation parsing and ledger ordering on [gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md); the edit-event counter, token matching, read-only `gh` workarounds, chain routing and PR-body limits on [critique and delivery gates](agent-routing-f0909b2-critique-and-delivery-gates.md). See also [PR-Approver: Decision Procedure](../concepts/review-approver-decision-procedure.md), [Challenger Calibration](../concepts/review-approver-challenger-calibration.md), [PR Review Practices](../concepts/review-pr-practices.md).

## The gate is two instruments that fail in opposite directions

`gate-critique-on-deliver.sh` decides whether a call is a delivery and errs by over-including; `track-critique.sh` decides what codex said and errs by under-recording, silently keeping a previous approval when it cannot parse the current verdict. The first costs rounds; the second lets a must-fix ship, and after several bogus denials an `OUTPUT_REVIEW=approve` reads as the instrument finally agreeing. Every other defect (over-blocking reads, a session born denied by the workspace-scoped counter) fails closed ([the verdict recorder fails OPEN](../learnings/1785989503064-the-critique-gate-verdict-recorder-fails-open-a-mu.md)).

## Input side: fails-closed false positives

Four modes (mostly slang PR #12378) cost real rounds without a real problem ([gate false positives](../learnings/1785992478312-critique-gate-false-positives-it-cannot-tell-a-get.md)); workarounds are on [critique and delivery gates](agent-routing-f0909b2-critique-and-delivery-gates.md).

1. **Verb-blind.** The `gh api [^|]*pulls\b` arm has no HTTP method, so a read-only `gh api repos/O/R/pulls/<n> --jq '.body'` is denied as PR creation. A PR is an issue: `gh api repos/O/R/issues/<n>` returns the same `body`, `labels` and `state`, the workaround and the correct verification fetch.
2. **Command text, not effect.** A `python3 - <<'PY'` note mentioning `gh api … pulls`, or a literal `gh pr create` inside a heredoc'd script (slang#13742), is denied; author such files with the Write tool and run a bare `python3 script.py` ([disabled:// push URL is codex's own guard](../learnings/1792294811857-codex-critique-tell-codex-its-disabled-push-url-is.md)).
3. **`edits_since_critique` is container-wide.** "1 edit recorded since the last critique" came from a peer session's worktree (`wt-slang-12371`) in the same container. The approve is per-session, and the attested-hash set answers "did my artifact change?"; if all hashes match it still binds:

```bash
STATE=/workspace/.claude/workflow-state.json
jq -r '(.critique_attested//{}).OUTPUT_REVIEW//{}|keys[]' "$STATE" | while read -r p; do sha256sum "$p"; done
jq -r '(.critique_attested//{}).OUTPUT_REVIEW//{}|to_entries[]|"\(.value)  \(.key)"' "$STATE"   # recorded
```

4. **A missing state directory blocks everything.** Without `/workspace/.claude/` the hook's `> "$STATE.tmp"` fails (`line 417: … No such file or directory`) and every call is blocked (slang#12924): `mkdir -p /workspace/.claude` at session start; read via `gh pr view --json …`, `gh pr diff <n>` or `gh api repos/O/R/issues/<n>`. Skill scripts (`collect-reviews.sh`, `eval-clauses.py`) hide their inner `gh api .../pulls`, since only the top-level command string is inspected ([read-only `gh api .../pulls` blocked; missing state dir](../learnings/1788945661953-approver-tooling-critique-gate-hook-blocks-read-on.md)).

## What counts as a round, and what an approve binds

`track-critique.sh` records a fresh `mcp__codex__codex` call only when the prompt carries `STAGE: <stage>`, `ROUND:` and `REQUIREMENTS:`, the developer-instructions hold both sentinel lines of the `/codex-critique` block verbatim, `sandbox` is `danger-full-access`, and the reply has `### Verdict` then `approve` (details on [gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md)); an ad-hoc call answered "APPROVE" is a wasted round (#14159, [canonical block only](../learnings/1793846123023-track-critique-gate-output-review-counts-only-with.md)). A `STAGE:` `codex-reply` is refused, a freeform call logs "stages: none", and codex nits a new item every round, so "3 rounds → escalate" is real ([codex-reply rounds don't count](../learnings/1789486053134-slangpy-pr-review-pin-to-explicit-shas-shared-chec.md)). A thread opened with your own prompt or a read-only sandbox records nothing and refuses `codex-reply` ("developer-instructions do not match"), so each round is a new `danger-full-access` call with the verbatim block (`ROUND: 2/3 — addressed M1 …`) carrying the prior findings (slang#14027) [non-canonical threads don't count](../learnings/1793292848270-critique-gate-codex-reply-rounds-and-non-canonical.md).

**REQUIREMENTS format.** After `ROUND:` comes `REQUIREMENTS: none — <reason>` or a multi-line `R1. "<verbatim maintainer quote>" — https://github.com/<owner>/<repo>/issues/<n>#issuecomment-<id>` list (`#discussion_r<id>` also works); a one-line `·`-separated summary is "round NOT recorded". OUTPUT_REVIEW grades every R-item, so one the orchestrator scoped out stays a merge blocker until the maintainer defers it on record: label it "pending maintainer deferral" and ask on the PR with the complete unchecked set. The fixer's `[Fix Review Request]`/`[Fix Report]` gate needs `PLAN_REVIEW=approve` as well as `OUTPUT_REVIEW=approve` ([multi-line R<n> quotes](../learnings/1790758204134-codex-critique-requirements-must-be-multi-line-r-n.md); scope rule in [Working Live PRs Alongside Maintainers](../concepts/review-maintainer-live-pr-interaction.md)).

**The gate binds by content.** `### Attested` sha256s are re-hashed at send, and any write after the last OUTPUT_REVIEW approve (a scratch file, a `.gh-comments/` id file) is an edit; a verdict-bearing chain-close (`[Resolution]`/`[Review Verdict]`) fires a `[GATE AUDIT]` demanding every required stage ≥1 plus `OUTPUT_REVIEW=approve` ([exact-format calls; Attested re-hashes at send](../learnings/1790016287155-critique-gate-resolution-pr-delivery-only-counts-c.md), [chain-close trips the gate](../learnings/1790042386094-verdict-bearing-chain-close-messages-resolution-re.md)). Upserting the PR explanation comment is such an edit, so OUTPUT_REVIEW re-runs before `[Fix Review Request]` ([round 1 recall summary](../learnings/1793815964150-codex-critique-round-1-can-return-a-wiki-recall-su.md)). The public-comment gate checks a comment file against `### Attested` only at 1,000+ characters, PATCHes included ([fixer delivery gates](../learnings/1793850163791-fixer-delivery-gates-review-request-field-format-i.md)), and matches entries by ABSOLUTE path, refusing a relative one even when the sha256 matches, so have codex emit absolute paths (PR #13867, [absolute-path Attested](../learnings/1793228747743-codex-critique-a-first-call-can-return-wiki-recall.md)).

**Verdicts outlive their phase.** The gate keys on the session's last verdict per stage, so a session revived months later is still blocked: on slang-rhi#810 August PLAN/CODE_REVIEW `must-fix` verdicts refused a read-only `gh api repos/.../pulls/810`. Read via `issues/<n>`, write memory with Edit, and run fresh PLAN/CODE/OUTPUT_REVIEW rounds for the new phase against a new plan file under `reports/` [stale earlier-phase verdicts](../learnings/1793274740895-stale-critique-verdicts-from-an-earlier-phase-bloc.md).

**Abstain `[Approval Decision]` sends.** The case-sensitive whole words `WOULD_APPROVE`/`BLOCK` suppress the ABSTAIN fast-path: "**Not BLOCK**" spends a `critique_gate_denials` strike (soft cap 3), so write "not a code-defect rejection" or lowercase "blocking". `gate-chain-routing.sh` also needs `in_reply_to=<tasking inbound id>` on any marker send, even to a dashboard destination on the `ABSTAIN_POLICY` path; keep the explicit `to=` ([abstain sends: no whole-word BLOCK; set in_reply_to](../learnings/1789057110525-approver-infra-abstain-approval-decision-abstain-m.md)).

**The PR-description gate outranks the upstream five-part format.** Codex reads upstream slang `CLAUDE.md` and must-fixes a concise body, but `gate-pr-description.sh` refuses over 1000 characters or 2 lines per section and `/explain-diff-html` holds the explanation in one PR comment, so the Process report goes there; say so up front, citing the hook, and codex accepts. The hook also refuses `gh pr edit --body-file X` in the Bash command that writes X ([OUTPUT_REVIEW recording pitfalls](../learnings/1792831235444-codex-critique-output-review-recording-pitfalls-fo.md)).

## The gate is code-blind: no-code closes still need every stage

The gate keys off delivery markers (`[Resolution]`, `[Report]`), not off code, so a zero-diff triage-confirmation is blocked until PLAN_REVIEW, CODE_REVIEW and OUTPUT_REVIEW (`approve`) are recorded. Satisfy it honestly: write the deliverable to a file and run PLAN_REVIEW on the no-code approach, CODE_REVIEW on `git status --porcelain` + `git diff --stat` and OUTPUT_REVIEW on the report as parallel canonical calls ([no-code triage-confirmations](../learnings/1783523465568-critique-gate-fires-on-no-code-triage-confirmation.md)).

## Output side: the verdict recorder fails OPEN

Neither `critique_verdicts[STAGE]` nor the `Critique round N recorded` notice is trustworthy; codex's own `### Verdict` is the truth. On shader-slang/slang#12089 codex returned `must-fix` on three consecutive `OUTPUT_REVIEW` rounds and the hook printed `OUTPUT_REVIEW=approve` each time ([the verdict recorder fails OPEN](../learnings/1785989503064-the-critique-gate-verdict-recorder-fails-open-a-mu.md)). In `track-critique.sh`:

| `tool_response` shape | parsed `RAW_VERDICT` | recorded |
|---|---|---|
| `{content: [{type:"text", text:"### Verdict\nmust-fix…"}]}` — the **MCP array** | *(empty)* | `""` |
| `{threadId:…, content:"### Verdict\nmust-fix…"}` — the shape the hook's comment documents | `must-fix` | `must-fix` |

`:68-72` runs `jq -r '.content'` assuming string-or-object, so an array renders as JSON text and the `:80-91` awk match on `^###[ \t]*verdict` never fires; the writes at `:183`/`:196`/`:205` are guarded `if $v != "" then … else . end`, so an empty parse preserves the previous value; and the `:96` `*) VERDICT="unparseable"` fail-closed arm is unreachable because the failure yields `""`. The hook's header says this defect class was fixed once before for another input shape. Tell: a verdict that never changes across rounds that returned must-fix items.

**Replies that are no review are recorded too.** A canonical call returning 2–5 `/workspace/shared/wiki/...` recall bullets and no `### Verdict` (or nothing, #13564) counts as a round, and the guarded write keeps the stage's previous verdict: no verdict stays blocked, a prior `approve` survives. It recurred through 2026-11-05 (#13817, PR #13867, slang#14297; [recall digest records approve](../learnings/1793206692748-codex-output-review-can-return-a-recall-digest-ins.md), [first-call recall](../learnings/1793228747743-codex-critique-a-first-call-can-return-wiki-recall.md), [round 1 recall summary](../learnings/1793815964150-codex-critique-round-1-can-return-a-wiki-recall-su.md), [prefix the prompt](../learnings/1793779536331-codex-critique-prefix-the-prompt-with-do-not-run-a.md), [recall notes recorded as approve](../learnings/1793839501898-codex-output-review-can-return-recall-notes-and-st.md)). On #13817 the re-ask returned a real must-fix. A recorded approve proves only that a call was made; without a structured review, verify factual claims (line numbers, counts, quoted lines) yourself before posting ([recall list instead of a review](../learnings/1792072692925-codex-critique-sometimes-returns-a-recall-list-ins.md)).

**The cause is the working directory; fix it on the first call.** With `cwd: /workspace/agent` codex reads that directory's `AGENTS.md` (a symlink to the group's `CLAUDE.md`), whose memory rule says to recall from the shared wiki, so the first reply is ≤5 recall bullets or nothing (slang#13564, #13636, #13673). Set `cwd` outside it (`/tmp`, a scratch dir, or the per-issue worktree, whose repo `AGENTS.md` has no recall rule) and open with "Do NOT run a wiki or learnings recall and do not summarize prior notes — perform the review below directly and return only the structured output", which got a first review after six stubs [prefix the prompt](../learnings/1793779536331-codex-critique-prefix-the-prompt-with-do-not-run-a.md). Sessions doing both got an attested review first try: slang#13742, #13993 [recall-only reply records no verdict](../learnings/1793220323154-slang-compare-compute-fails-on-any-stderr-warning-.md), slang#14027 [non-canonical threads](../learnings/1793292848270-critique-gate-codex-reply-rounds-and-non-canonical.md), slang-rhi#810 [stale verdicts](../learnings/1793274740895-stale-critique-verdicts-from-an-earlier-phase-bloc.md), slang#14297 [round 1 recall summary](../learnings/1793815964150-codex-critique-round-1-can-return-a-wiki-recall-su.md). The no-recall line alone, `cwd` unchanged, failed on slang-vscode-extension#78 ([cwd outside /workspace/agent](../learnings/1792695817981-codex-critique-run-with-cwd-outside-workspace-agen.md), [fresh sessions run the AGENTS.md rule](../learnings/1792136592884-fresh-codex-sessions-in-workspace-agent-run-the-ag.md), [skip recall in the prompt](../learnings/1792294811857-codex-critique-tell-codex-its-disabled-push-url-is.md)).

**Same-thread recovery is weaker.** A `codex-reply` carrying `STAGE:` is refused ([cwd=/workspace/agent → recall bullets](../learnings/1792074066723-codex-critique-cwd-workspace-agent-can-make-codex-.md)); a STAGE-less same-thread reply ("your reply was a recall summary — perform the review and return ONLY the structured output") elicits the review ([gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md); [reply on the same thread](../learnings/1792429620370-codex-critique-with-cwd-workspace-agent-returns-a-.md)). Whether it is RECORDED turns on two parses. A reply finds its stage via the `critique_threads` map written at the initial call; unmapped, it updates only `last_critique_verdict` and a fresh call must re-attest ([prefix the prompt](../learnings/1793779536331-codex-critique-prefix-the-prompt-with-do-not-run-a.md)), while a mapped reply records (#14159, slang#14317). `### Attested` lines record only when they match `-[ \t]*<64-hex>[ \t]+<path>`; backticks around the hash or path record nothing, the stage keeps the earlier approve's hashes, and delivery is refused with "reviewed artifacts changed since the OUTPUT_REVIEW approve" though the current hashes match ([recall stub](../learnings/1792695817981-codex-critique-run-with-cwd-outside-workspace-agen.md); slang#14317 [backticked hashes dropped](../learnings/1793830181320-critique-gate-backticked-attestation-hashes-are-si.md)). Ask for plain `- <sha256> <absolute path>` lines in the first prompt (or in a `codex-reply` that keeps the verdict), prefer a fresh call with the corrected `cwd`, and after any reply-recovered round inspect `.critique_verdicts` and `.critique_attested.OUTPUT_REVIEW` against your files before delivering ([recall notes recorded as approve](../learnings/1793839501898-codex-output-review-can-return-recall-notes-and-st.md)).

## A gate-blocked delivery is an outstanding action

On slang PR #12378 a reviewer reported the same stale `742/742` in the PR body for eight rounds; each round it was fixed locally (`grep -c` returned 0) and reported fixed, yet the posted body was byte-identical to one eight rounds old ([a local fix is not a fix to the published copy](../learnings/1785992450842-a-fix-to-your-local-artifact-is-not-a-fix-to-the-p.md)). The loop: edit local → `gh` body update → hook denies → satisfy the gate → never return to the update, since an approval feels like completion. Write down the retry of every gate-denied call; when a reviewer contradicts your local measurement, suspect delivery; diff content, never count (one body had three different correct lengths). Verify on the gate-safe issues endpoint, stripping GitHub's CRLF and `jq -r`'s trailing newline:

```bash
gh api repos/O/R/issues/<n> --jq '.body' > /tmp/live.txt   # PR bodies are served here too
tr -d '\r' < /tmp/live.txt | sed -e '$ { /^$/d }' > /tmp/live-norm.txt
diff /tmp/live-norm.txt ./local-body.md && echo "PUBLISHED == LOCAL"
```

**Hard-block escalation is a human approval.** On the third deny of a coworker's `gh pr create` on an unfixable must-fix, the host creates a `critique_gate_bypass` row in `pending_approvals` routed to `dashboard-admin`; `ncl approvals` is list/get only, so no orchestrator can flip it. On Approve, `src/modules/critique-escalation/` sets `critique_gate_bypass_approved=true` and the `gh pr create` fires on its own; Reject routes to the pre-agreed clean path. The orchestrator hands the operator the `approval_id` (`ncl approvals list`, `action=critique_gate_bypass`) with a recommendation, never telling the coworker "proceed". A gate-blocked coworker opens a draft PR or escalates promptly (slang#12622 idled 13 days); a draft skips CI (`ci.yml` filters `draft != true`) and is not auto-merged ([bypass is a human approval](../learnings/1789272925575-critique-gate-bypass-is-a-human-dashboard-approval.md)).

## Gate-scope error: a must-fix on an input the approver cannot edit

On slang#12453 @425c2a95 DECISION_REVIEW held must-fix for three rounds after every factual catch was fixed, its sole objection two PR-author comments narrating history. That is a gate-scope error: comment hygiene is scoped to the agent's own diff, the approver's diff is untrusted read-only input, the rule conflicts with slang's CLAUDE.md, and a maintainer had already APPROVED the exact head. Accept every factual catch (miscounts, wrong line numbers, CI-green-as-coverage) and let WOULD_APPROVE coexist with clarity nits. The host records WOULD_APPROVE/BLOCK only after a critique `approve` but relaxes that for ABSTAIN_\*, so the honest label is ESCALATED (a gate/approver deadlock), not CHALLENGER_CONCERN or a silent WOULD_APPROVE. The durable fix is an approver-context carve-out exempting PR-author comment style from DECISION/OUTPUT_REVIEW must-fix ([comment hygiene over-applied](../learnings/1786490730776-approver-critique-mustfix-critique-gate-over-appli.md)).

Codex also must-fixes its own sandbox: its guard rewrites git push URLs to `disabled://…` and it holds no gh token, so PLAN/CODE_REVIEW flags "push target disabled / PR not opened" (slang#13742). Say in the WHY that this is codex's sandbox, the author pushes through the credential gateway, and CODE_REVIEW gates `gh pr create`, so "no PR yet" is expected ([disabled:// is codex's own guard](../learnings/1792294811857-codex-critique-tell-codex-its-disabled-push-url-is.md)).

## DECISION_REVIEW earns its keep, on the verdict and on the rationale

On slang#12892 DECISION_REVIEW flipped a decision on the merits: the parser fix enables a branch with two accepting arms (`checkedBase` a single `DeclRefExpr` vs an `OverloadedExpr`), the new test exercised only the `OverloadedExpr` arm, and no `->` generic-member-call test pre-existed, so WOULD_APPROVE became ABSTAIN_POLICY:OPEN_GAP; shared-machinery analogy does not clear an untested arm ([a test per arm](../learnings/1789066986411-approver-critique-mustfix-a-fix-that-enables-a-mul.md)). On the slang#12993 cleanup it must-fixed rationale accuracy twice: "all argument access goes through the bounds-checked `get(i)`" came from `grep … | head -40` on a 1067-line file and was false (a direct `args[0]` at line 1059). Before any universal ("all"/"never"/"cannot") claim, `wc -l` and grep the whole file; scope claims to what you verified ([universal claims need whole-file evidence](../learnings/1789058775886-approver-critique-mustfix-universal-safety-claims-.md)).

## What the recording is for: the human-agreement join

Everything above serves a `record_decision` row in the `approval_decisions` ledger, pinned to a commit and later scored against what the humans did. Worked example: shader-slang/slang#12322 (gate `-emit-cpu-via-llvm` tests on LLVM availability), decided `WOULD_APPROVE` / `CLEAN` at `ba156ebf5c90` ([#12322 APPROVED at the decided SHA](../learnings/1785987292855-approver-human-agreement-slang-12322-joined-merged.md)). It merged at the exact decided head, scored off `pulls/<n>.head.sha`, never git ancestry: in a squash-only repo `merge-base --is-ancestor` gives an authoritative-looking false negative. A formal `APPROVED` at that commit approves the identical artifact, stronger than a merge.

**Averted false-abstains and declined checks leave no error signal.** "New flag + new gate" triggers a dead-flag probe that mandates `ABSTAIN_POLICY:OPEN_GAP` absent a trigger-present control. On #12322 it was rightly declined because the input failed its precondition: the gate (`_canIgnore`, `tools/slang-test/slang-test-main.cpp:4940-4944`) and flag bit (`SLANG_PASS_THROUGH_LLVM`) pre-existed, only two writers were added, and `addUsedBackEnd` (`tools/slang-test/test-context.h:55-62`) is a pure OR, so a test can move running→`Ignored`, never back and never →`Fail`. Demanding the control would have false-abstained an approved PR, and only the join records that (a correct procedure on a misclassified input fails silently). Doc-vs-diff drift stays advisory for this repo, never `OPEN_GAP`; an advisory the humans declined is as informative as one they acted on.

**Checks that correctly do not fire.** `nv-slang-bot[bot]` reported #12322 evicted from the queue by the tracked, non-causal Falcor flake #12145; the head stayed green and the PR merged — a no-op twice over, since the comment is bot-authored and the head never moved.

---
**Source learnings (33):**
- [exact-format codex calls only; Attested re-hashes at send](../learnings/1790016287155-critique-gate-resolution-pr-delivery-only-counts-c.md)
- [chain-close messages trip `[GATE AUDIT]`](../learnings/1790042386094-verdict-bearing-chain-close-messages-resolution-re.md)
- [abstain `[Approval Decision]`: no BLOCK/WOULD_APPROVE; set in_reply_to](../learnings/1789057110525-approver-infra-abstain-approval-decision-abstain-m.md)
- [OUTPUT_REVIEW recording pitfalls for slang-fixer](../learnings/1792831235444-codex-critique-output-review-recording-pitfalls-fo.md) — Process report in the explanation comment.
- [multi-arm branch needs a test per arm](../learnings/1789066986411-approver-critique-mustfix-a-fix-that-enables-a-mul.md)
- [universal claims need whole-file evidence](../learnings/1789058775886-approver-critique-mustfix-universal-safety-claims-.md)
- [gate false positives: GET vs POST, container counter, command text](../learnings/1785992478312-critique-gate-false-positives-it-cannot-tell-a-get.md)
- [the verdict recorder fails OPEN](../learnings/1785989503064-the-critique-gate-verdict-recorder-fails-open-a-mu.md)
- [OUTPUT_REVIEW recall notes recorded as approve](../learnings/1793839501898-codex-output-review-can-return-recall-notes-and-st.md)
- [prefix the prompt](../learnings/1793779536331-codex-critique-prefix-the-prompt-with-do-not-run-a.md) — unmapped reply not recorded.
- [round 1 can return a recall summary](../learnings/1793815964150-codex-critique-round-1-can-return-a-wiki-recall-su.md) — explanation upsert is an edit.
- [backticked attestation hashes are silently dropped](../learnings/1793830181320-critique-gate-backticked-attestation-hashes-are-si.md)
- [OUTPUT_REVIEW counts only with the canonical block](../learnings/1793846123023-track-critique-gate-output-review-counts-only-with.md) — the four recording conditions.
- [fixer delivery gates: field format, in_reply_to, quiz positions](../learnings/1793850163791-fixer-delivery-gates-review-request-field-format-i.md) — 1,000-char comment rule.
- [recall list instead of a review](../learnings/1792072692925-codex-critique-sometimes-returns-a-recall-list-ins.md) — verify claims yourself.
- [recall digest still records approve](../learnings/1793206692748-codex-output-review-can-return-a-recall-digest-ins.md) — #13817 re-ask found a must-fix.
- [first-call recall; absolute-path Attested](../learnings/1793228747743-codex-critique-a-first-call-can-return-wiki-recall.md)
- [cwd=/workspace/agent → recall bullets](../learnings/1792074066723-codex-critique-cwd-workspace-agent-can-make-codex-.md)
- [fresh sessions run the AGENTS.md recall rule](../learnings/1792136592884-fresh-codex-sessions-in-workspace-agent-run-the-ag.md)
- [disabled:// push URL is codex's guard; skip recall](../learnings/1792294811857-codex-critique-tell-codex-its-disabled-push-url-is.md)
- [recall summary — reply on the same thread](../learnings/1792429620370-codex-critique-with-cwd-workspace-agent-returns-a-.md)
- [run with cwd outside /workspace/agent](../learnings/1792695817981-codex-critique-run-with-cwd-outside-workspace-agen.md) — reply keeps the stub's attestation.
- [a local fix is not a fix to the published copy](../learnings/1785992450842-a-fix-to-your-local-artifact-is-not-a-fix-to-the-p.md)
- [slang#12322 APPROVED at the decided SHA](../learnings/1785987292855-approver-human-agreement-slang-12322-joined-merged.md) — score off `head.sha`.
- [gate fires on no-code triage-confirmations](../learnings/1783523465568-critique-gate-fires-on-no-code-triage-confirmation.md)
- [comment-hygiene over-applied to PR-author comments](../learnings/1786490730776-approver-critique-mustfix-critique-gate-over-appli.md) — slang#12453; ESCALATED.
- [read-only `gh api .../pulls` blocked; missing state dir](../learnings/1788945661953-approver-tooling-critique-gate-hook-blocks-read-on.md)
- [bypass is a human approval; draft PR is the valve](../learnings/1789272925575-critique-gate-bypass-is-a-human-dashboard-approval.md)
- [codex-reply rounds don't count; pin explicit SHAs](../learnings/1789486053134-slangpy-pr-review-pin-to-explicit-shas-shared-chec.md)
- [REQUIREMENTS: multi-line R<n> quotes with URLs](../learnings/1790758204134-codex-critique-requirements-must-be-multi-line-r-n.md)
- [COMPARE_COMPUTE fails on any stderr warning](../learnings/1793220323154-slang-compare-compute-fails-on-any-stderr-warning-.md) — (side-fact) recall-only reply.
- [stale earlier-phase verdicts block read-only gh](../learnings/1793274740895-stale-critique-verdicts-from-an-earlier-phase-bloc.md)
- [non-canonical threads record nothing](../learnings/1793292848270-critique-gate-codex-reply-rounds-and-non-canonical.md) — fresh call per round.

_Catalog: [[wiki/index.md]]_

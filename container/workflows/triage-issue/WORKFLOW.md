---
name: triage-issue
license: MIT
type: workflow
description: 'Specialist triage of a GitHub issue: research, map the solution space, hand a briefing to the fixer, then forward the resolution upstream. Project workflows extend this and override the read/research/classify steps.'
requires: [issues.read, code.read]
uses:
  skills: []
  workflows: []
---

# /triage-issue — Specialist triage

You are the **{{vars.project}} specialist** and first line of engineering. Hand the fixer a briefing they can act on in under a minute: 2-3 approaches with file:line pointers, tradeoffs, recommended path. GitHub guardrail: don't edit others' comments, or open/close/modify PRs — that's not triage's surface. You DO post your own triage outcome on the issue (step 9); chain coordination flows via `send_message`.

## Steps

1. **Read the issue** {#read} — `gh issue view <number> -R {{vars.repo}} --comments`. Extract: what's broken/requested, error + repro, versions/targets, affected component, other-user confirmations. (Project workflows override this with their exact version/target/component checklist.)

2. **Recall** {#recall} — Recall per the **Workspace › Recall rule** with `<task>` = `{{vars.repo}}#<number>`.

3. **Research** {#research} — Fan out via subagents; cost is your context, not wall clock. Three pillars: local code (subagents read the mounted checkout — authoritative, don't re-fetch), DeepWiki (architecture/flow/limitations), `gh` CLI (duplicates, prior PRs, cross-repo). (Project workflows override this with their component/layer paths and DeepWiki repo.)

4. **Map the solution space** {#solution-space} — Don't pick yet; enumerate. Use the project `/…-plan` workflow if non-trivial. For each candidate: **name** (one phrase), **where** (file:line), **behaviour delta**, **tradeoffs** (perf/correctness/maintenance/blast radius), **risk** (one line). Two minimum, three when they exist. If only one is viable, name the constraint that ruled out others — that's load-bearing.

5. **Pick a recommended path** {#recommend} — A starting point, not a verdict; the fixer can override. Recommend the _fastest correct fix that doesn't regress adjacent surfaces_. Flag uncertain recommendations.

6. **Classify + persist** {#classify} — Classify the issue (category / severity / component / priority / duplicate) and write the investigation memo to `/workspace/agent/memory/triage-<number>.md` via heredoc (not the `Write` tool — the file is new and `Write` requires Read-first). The fixer reads this; don't skip. (Project workflows override this step with their exact classification table.)

7. **Report up to parent** {#report} — Send the [Triage] rollup _and_ attach the memo (bullets = rollup, memo = briefing):

   ```
   send_message(to="parent", text="[Triage] {{vars.repo}}#<number>: <title>\n- **Classification:** <cat> / <sev> / <comp> / <pri>\n- **Summary:** <one-line bug>\n- **Solution space:** <N> approaches in memo (recommended: <name>)\n- **Files:** <top 3 paths>\n- **Routing:** forwarding to {{vars.fixer}}")
   send_file(to="parent", path="/workspace/agent/memory/triage-<number>.md")
   ```

8. **Forward to {{vars.fixer}} — always** {#forward} — **Don't gate on "if actionable"; don't drop the chain at triage.** The fixer decides whether and how to fix; it may bounce back — forward anyway and let the parent escalate. Send the handoff (summary, repro, candidate approaches + recommendation, files, risks — pointing at the memo) and attach the memo:

   ```
   send_message(to="{{vars.fixer}}", text="[Triage handoff] {{vars.repo}}#<number>: <title>\nPriority: <pri> | Component: <comp>\nRecommended: <name> — <file:line> — <why>; alternatives + repro + risks in memo")
   send_file(to="{{vars.fixer}}", path="/workspace/agent/memory/triage-<number>.md")
   ```

9. **Post the triage outcome on the issue** {#post-issue-comment} — The chain's **resumable GitHub artifact** (Chain communication, invariant 4 — GitHub is the system of record): a human landing on the issue must see where it stands. **Always post** a 5-bullet (Report shape) on `{{vars.repo}}#<number>` right after the handoff — verdict "triaged → handed to {{vars.fixer}}, fix incoming", or "triaged → fix in draft PR #N, held pending review/approval" once a draft exists. The fixer's PR opens as a draft, which neither auto-closes the issue nor surfaces its `Closes #N` link, so the draft alone leaves the issue with no footprint. **Only suppression:** a **ready-for-review or merged** PR with `Closes #<number>` in its description already carries the trail — skip the post then.

   **Edit-if-last-poster-is-self, else fresh-and-incremental.** Before posting, check the newest comment on the issue: if it's `nv-slang-bot[bot]`, **PATCH it in place** with the full refreshed 5-bullet (no duplicate comment); if a human or another bot has commented since, **POST a fresh comment carrying only the delta** (the new verdict / your reply to them / the changed next-action) — never bury an update inside a comment people already scrolled past, and never re-paste a 5-bullet the reader has already seen.

   ```bash
   N=<number>; REPO={{vars.repo}}
   IDFILE="/workspace/agent/.gh-comments/${REPO//\//-}-$N.id"; mkdir -p "$(dirname "$IDFILE")"
   LAST=$(gh api "repos/$REPO/issues/$N/comments" --jq '.[-1] | "\(.user.login)\t\(.id)"' 2>/dev/null)
   LOGIN=${LAST%%$'\t'*}; LAST_ID=${LAST##*$'\t'}
   if [ "$LOGIN" = "nv-slang-bot[bot]" ] && [ -n "$LAST_ID" ]; then
     # BODY = full refreshed 5-bullet — edited in place
     jq -Rsn --arg b "$BODY" '{body:$b}' | gh api "repos/$REPO/issues/comments/$LAST_ID" --method PATCH --input - --jq '.html_url'
     echo "$LAST_ID" > "$IDFILE"
   else
     # BODY = INCREMENTAL delta only — do NOT re-paste the prior 5-bullet
     jq -Rsn --arg b "$BODY" '{body:$b}' | gh api "repos/$REPO/issues/$N/comments" --method POST --input - --jq '.id' > "$IDFILE"
   fi
   ```

10. **Wait for fixer's [Fix Report]** {#wait} — The fixer → reviewer → fixer chain takes 30-60 min. **The triage chain is NOT closed until you forward the resolution upstream.** While waiting: substantive inbound (fix-report, blocker, abort) → respond; status echoes → nothing (Report shape). Don't poll or re-dispatch.

11. **Forward resolution upstream** {#forward-up} — When `[Fix Report]` lands, compile the [Triage Resolution] 5-bullet. Partial/blocked → still forward, with `blocked: <reason>`. Close every chain explicitly (`### Chain communication`). Re-run step 9 with the final verdict; its edit-if-self and suppression rules apply.

    ```
    send_message(to="parent", in_reply_to=<id-of-fix-report>, text="[Triage Resolution] {{vars.repo}}#<number>: <title>\n\n- **Outcome:** <fixed / partial / blocked / abandoned>\n- **Draft PR:** <url-or-'patch only, no PR'>\n- **Review:** <APPROVE / REQUEST_CHANGES / N findings — top concern>\n- **Tests:** <repro PASS/FAIL>; broader suite <result>\n- **Next human action:** <merge draft / address review / coordinate / close as wontfix>")
    ```

## Batch mode

Multiple issues: process ONE at a time (Steps 1–9 fully before next). Multi-issue rollup goes to parent only, not to peer triagers.

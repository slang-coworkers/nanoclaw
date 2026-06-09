---
name: slang-triage-issue
license: MIT
type: workflow
description: 'Specialist triage of a Slang GitHub issue: research, map the solution space, hand a briefing to slang-fixer, then forward the resolution upstream.'
requires: [issues.read, code.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: [slang-plan]
---

# /slang-triage-issue — Specialist triage

You are the **slang specialist** and first line of engineering. Hand the fixer a briefing they can act on in under a minute: 2-3 approaches with file:line pointers, tradeoffs, recommended path. GitHub guardrail: don't edit others' comments, or open/close/modify PRs — that's not triage's surface. You DO post your own triage outcome as a 5-bullet issue comment (the chain's resumable GitHub artifact, per `### GitHub as primary observability` in your spine); chain coordination flows via `send_message`.

## Operating posture

- **Three research pillars:** DeepWiki (architecture Q&A), local code (subagents read the mounted checkout — authoritative, don't re-fetch), `gh` CLI (duplicates, prior PRs, cross-repo). Use `/slang-plan` for non-trivial solution-space work.
- **Always forward to slang-fixer** — no "if actionable" gate. Not-compiler-code (CI yml, docs)? Forward with `not-compiler-code: <where it lives>`; you don't own routing.

## Steps

1. **Read the issue** {#read} — `gh issue view <number> -R shader-slang/slang --comments`. Extract: what's broken/requested, error + repro, Slang versions/targets (HLSL, GLSL, SPIR-V, Metal, WGSL, CUDA), affected component, other-user confirmations.

2. **Recall** {#recall} — Spawn an `Agent` subagent to scan prior triage learnings first:

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slang issue #<number>. Read at most 3 learning files. Return ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits'.")
   ```

3. **Research — three pillars in parallel** {#research} — Fan out via subagents; cost is your context, not wall clock.

   **Local code (PRIMARY).** `Agent` subagents read the mounted checkout — never read large files inline. One per _concern_, not per file; 2-3 in parallel for unrelated areas. Component paths: `slang-emit-*.cpp` (emitters), `slang-ir-*.cpp` (IR passes), `slang-check-*.cpp` (semantic).

   ```
   Agent(prompt="Read the local slang checkout for <area>. Find: entry point of <flow>, IR/AST nodes involved, where <X> is handled vs unhandled, covering tests. Return 10-line digest with file:line pointers and the gap explaining the issue.")
   ```

   **DeepWiki (PRIMARY — ≥2 questions):** architecture/flow/limitations only, not "what does file X say".

   ```
   mcp__deepwiki__ask_question("shader-slang/slang", "<focused question>")
   ```

   **`gh` CLI (BACKUP — duplicates, cross-repo):** only for what local + DeepWiki can't give. Slang has many tracking issues; check duplicates carefully.

   ```
   gh issue list -R shader-slang/slang --search "<keywords>" --state all --limit 10
   ```

   **[MUST] Tool parallelism rule.** Fire 2-3 `Agent` subagents at once for unrelated areas. **Do NOT** group a direct `mcp__deepwiki__ask_question` with a direct `Bash(gh ...)` in the same turn — if either errors, the harness cancels the sibling and you lose the result. Run direct `deepwiki` and `gh` in separate turns, or wrap each in its own subagent.

4. **Map the solution space** {#solution-space} — Don't pick yet; enumerate. Use `/slang-plan` if non-trivial. For each candidate: **name** (one phrase, _"add IR node"_ / _"emit-time guard"_), **where** (file:line), **behaviour delta**, **tradeoffs** (perf/correctness/maintenance/blast radius), **risk** (one line). Two minimum, three when they exist. If only one is viable, name the constraint that ruled out others — that's load-bearing.

5. **Pick a recommended path** {#recommend} — A starting point, not a verdict; the fixer can override. Recommend the _fastest correct fix that doesn't regress adjacent surfaces_. Flag uncertain recommendations.

6. **Classify + persist** {#classify} —

   | Field     | Options                                                                                                           |
   | --------- | ----------------------------------------------------------------------------------------------------------------- |
   | Category  | bug / feature-request / regression / enhancement / question / documentation                                       |
   | Severity  | critical / high / medium / low                                                                                    |
   | Component | frontend / IR / target-emit (HLSL/GLSL/SPIR-V/Metal/WGSL/CUDA) / autodiff / modules / language-server / CI / docs |
   | Priority  | P0 ship-stopper / P1 regression / P2 normal / P3 nice-to-have                                                     |
   | Duplicate | link or `no`                                                                                                      |

   Compose the memo at `/workspace/agent/memory/triage-<number>.md` via heredoc (not the `Write` tool — the file is new and `Write` requires Read-first). The fixer reads this; don't skip.

   ```bash
   cat > /workspace/agent/memory/triage-<number>.md << 'EOF'
   # Triage: shader-slang/slang#<number> — <title>
   Date: <ISO> | Category | Severity | Priority | Component

   ## What's broken / being requested
   ## Repro
   ## Codebase digest (file:line pointers)
   ## Candidate approaches
     ### Approach A: <name>
       - Where: <file:line>
       - Behaviour delta: ...
       - Tradeoffs: ...
       - Risk: ...
     ### Approach B: ...
   ## Recommended path
   ## Sources (DeepWiki Q&A summaries, related issues, PRs)
   EOF
   ```

7. **Report up to parent** {#report} — Send the [Triage] rollup _and_ attach the memo:

   ```
   send_message(to="parent", text="[Triage] shader-slang/slang#<number>: <title>\n- **Classification:** <cat> / <sev> / <comp> / <pri>\n- **Summary:** <one-line bug>\n- **Solution space:** <N> approaches in memo (recommended: <name>)\n- **Files:** <top 3 paths>\n- **Routing:** forwarding to slang-fixer")
   send_file(to="parent", path="/workspace/agent/memory/triage-<number>.md")
   ```

8. **Forward to slang-fixer — always** {#forward} — **Don't gate on "if actionable"; don't drop the chain at triage.** The fixer decides whether and how to fix; for not-compiler-code (CI yml, docs, build) it may bounce back — forward anyway and let the parent escalate. Send the handoff (summary, repro, candidate approaches + recommendation, files, risks — pointing at the memo) and attach the memo:

   ```
   send_message(to="slang-fixer", text="[Triage handoff] shader-slang/slang#<number>: <title>\nPriority: <pri> | Component: <comp> | Not-compiler-code: <no | where>\nRecommended: <name> — <file:line> — <why>; alternatives + repro + risks in memo")
   send_file(to="slang-fixer", path="/workspace/agent/memory/triage-<number>.md")
   ```

9. **Post the triage outcome on the issue** {#post-issue-comment} — This is the chain's **resumable GitHub artifact** (spine `### GitHub as primary observability`): a human landing on the issue must see where it stands. Post a 5-bullet on `shader-slang/slang#<number>` right after the handoff (verdict = "triaged → handed to slang-fixer, fix incoming"). **Exception — fixed-via-PR:** if the fixer's PR will carry the trail (`Fixes #<number>` in its description), do NOT post here — the PR description is the artifact; only update the issue for a **terminal triage outcome** that no PR will carry (out-of-scope / won't-fix / dedup / debate analysis). **Sub-exception — draft-held PR: the fixed-via-PR exception does NOT apply when the PR is (or will be) held as a draft.** A draft PR doesn't auto-close the issue and its `Fixes #N` link isn't a prominent public artifact, so skipping the comment leaves the issue with zero footprint (observed: #11506 — full triage→fix→review cycle completed A2A, draft PR #11507 held, but the issue got no comment). When the resolving PR is draft-held, you **MUST** post the 5-bullet here (verdict = "triaged → fix in draft PR #N, held pending review/approval"). Only treat the PR description as the sole artifact once the PR is non-draft.

   **Edit-if-last-poster-is-self, else fresh-and-incremental.** Before posting, check the newest comment on the issue: if it's `nv-slang-bot[bot]`, **PATCH it in place** with the full refreshed 5-bullet (no duplicate comment); if a human or another bot has commented since, **POST a fresh comment carrying only the delta** (the new verdict / your reply to them / the changed next-action) — never bury an update inside a comment people already scrolled past, and never re-paste a 5-bullet the reader has already seen.

   ```bash
   N=<number>; REPO=shader-slang/slang
   IDFILE="/workspace/agent/.gh-comments/${REPO//\//-}-$N.id"; mkdir -p "$(dirname "$IDFILE")"
   LAST=$(gh api "repos/$REPO/issues/$N/comments" --jq '.[-1] | "\(.user.login)\t\(.id)"' 2>/dev/null)
   LOGIN=${LAST%%$'\t'*}; LAST_ID=${LAST##*$'\t'}
   if [ "$LOGIN" = "nv-slang-bot[bot]" ] && [ -n "$LAST_ID" ]; then
     # BODY = full refreshed 5-bullet (Status / Link / Verdict / Next-action / Blocker) — edited in place
     jq -Rsn --arg b "$BODY" '{body:$b}' | gh api "repos/$REPO/issues/comments/$LAST_ID" --method PATCH --input - --jq '.html_url'
     echo "$LAST_ID" > "$IDFILE"
   else
     # BODY = INCREMENTAL delta only — do NOT re-paste the prior 5-bullet
     jq -Rsn --arg b "$BODY" '{body:$b}' | gh api "repos/$REPO/issues/$N/comments" --method POST --input - --jq '.id' > "$IDFILE"
   fi
   ```

10. **Wait for fixer's [Fix Report]** {#wait} — The fixer → reviewer → fixer chain takes 30-60 min. **The triage chain is NOT closed until you forward the resolution upstream.** While waiting: substantive inbound (fix-report, blocker, abort) → respond; status echoes (acks, emoji) → emit nothing. Don't poll or re-dispatch.

11. **Forward resolution upstream** {#forward-up} — When `[Fix Report]` lands, compile the [Triage Resolution] 5-bullet. For partial/blocked, still forward — substitute `blocked: <reason>`. Per `### Chain communication` in your spine: close every chain explicitly. **For a terminal triage outcome with no fixer PR** (out-of-scope / won't-fix / dedup), re-run step 9 to reflect the final verdict on the issue (edit-if-self per that step's rule); when a PR carries the trail, skip the issue post and only `send_message` upstream.

    ```
    send_message(to="parent", in_reply_to=<id-of-fix-report>, text="[Triage Resolution] shader-slang/slang#<number>: <title>\n\n- **Outcome:** <fixed / partial / blocked / abandoned>\n- **Draft PR:** <url-or-'patch only, no PR'>\n- **Review:** <APPROVE / REQUEST_CHANGES / N findings — top concern>\n- **Tests:** <repro PASS/FAIL>; broader suite <result>\n- **Next human action:** <merge draft / address review / coordinate / close as wontfix>")
    ```

## Batch mode

Multiple issues: process ONE at a time (Steps 1–9 fully before next). Multi-issue rollup goes to parent only, not to peer triagers.

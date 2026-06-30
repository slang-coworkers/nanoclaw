---
name: slangpy-pr-review
license: MIT
type: workflow
description: 'Review a SlangPy PR / branch / patch — read the diff, investigate the touched layers, produce a correctness + clarity verdict, and return it via send_file. If the dispatch carries <github-post-authorized /> (a human tagged @nv-slang-bot), also post the review back as a COMMENT-state review (never APPROVE/CHANGES_REQUESTED), minimizing any prior bot review first.'
requires: [code.read, issues.read, repo.read]
uses:
  skills: [slangpy-code-reader, slangpy-github]
  workflows: []
---

# /slangpy-pr-review — Review a SlangPy PR

Use when asked to review a SlangPy PR, branch, or patch. Produce one correctness-focused verdict and return it to the requester. Posting back to GitHub is **gated** on an explicit human authorization marker (see **Post review back to GitHub** and the `review-output.md` invariant).

This is the SlangPy counterpart to the slang `slang-pr-review` workflow. It is **single-reviewer and `gh`-based** — SlangPy has no `slangpy-pr-review-runner` / Devin / clarity-pipeline skills, so this workflow does the review directly with subagents over the mounted checkout rather than orchestrating external reviewer runners. If those runner skills are added later, widen this workflow to mirror the slang three-reviewer shape.

## Steps

1. **Determine input mode** {#input} — pick exactly one. If ambiguous, ask first.

   | Mode     | When                                   | Source of "what to review"                |
   | -------- | -------------------------------------- | ----------------------------------------- |
   | `pr`     | GitHub PR URL or `<owner>/<repo>#<n>`  | `gh pr diff <n> -R shader-slang/slangpy`  |
   | `branch` | Branch name (optional repo)            | Diff between branch and its base          |
   | `patch`  | Patch / diff / `.md` with unified diff | The provided diff, reviewed as-is         |

2. **Recall** {#recall} — Spawn an `Agent` subagent for prior reviewer flags / recurring patterns; wiki-first, raw fallback:

   ```
   Agent(prompt="Check if /workspace/shared/wiki/index.md exists. IF YES: read it with limit=100 (concepts section only — the file is large), identify concept pages relevant to SlangPy PR review or recurring reviewer flags, read up to 2 concept pages and follow their links to cited learnings if needed. If no concept fits, Grep wiki/ for keywords. IF NO wiki/ dir: fall back to Grep /workspace/shared/learnings/ for keywords and reading at most 3 hits. Return ≤5 bullets — title, 1-line summary, file path. No hits → 'no prior hits'.")
   ```

3. **Read the diff + investigate** {#review} — Pull the diff (`gh pr diff` / `git diff` / the patch). For each non-trivial hunk, spawn an `Agent` subagent (via `/slangpy-code-reader`) to read the touched layer in the mounted checkout and judge the change — never read large files inline. Layer paths: Python API `slangpy/core/*`, marshalling `slangpy/bindings/*` + `slangpy/builtin/*`, reflection `slangpy/reflection/typeresolution.py`, C++ `src/slangpy_ext/*`, GPU `src/sgl/*`, torch `slangpy/torchintegration/` + `src/slangpy_torch/`. Check: correctness (does it do what it claims, edge cases, cross-backend CUDA/Vulkan/D3D12/Metal), test coverage (is there a test exercising the change?), and clarity (is anything unclear / internally inconsistent / unexplained). Enforce the `code-changes.md` invariant.

4. **Write + report the verdict** {#report} — Compose the review to `/workspace/agent/review-<repo-slug>-<number>.md`: a short summary, then findings grouped **Bugs / Gaps / Questions / Clarity**, each with `file:line` and severity. Send it to the requester (and parent), and send the rolled-up verdict:

   ```
   send_file(to="parent", path="/workspace/agent/review-<repo-slug>-<number>.md")
   send_message(to="parent", in_reply_to=<id-of-review-request>, text="[Review Verdict] shader-slang/slangpy#<number> (<mode>)\n\n- **Verdict:** <APPROVE / APPROVE_WITH_NITS / REQUEST_CHANGES>\n- **Findings:** <X bugs, Y gaps, Z questions, W clarity>\n- **Top concern:** <one-line of the highest-severity finding, or 'no bugs'>\n- **Test gaps:** <one-line recommended tests, or 'none'>\n- **Next:** <post-back authorized? / send_file only>")
   ```

   If a `slangpy-fixer` destination is wired and this review was a fixer handoff, also `send_file(to="slangpy-fixer", …)` so the fixer can act on findings.

5. **Post review back to GitHub (authorized only)** {#post-review-to-github} — only when the dispatch carries the `<github-post-authorized />` marker (set when a human tagged `@nv-slang-bot` on the PR); else a no-op (the verdict already went out via **Write + report the verdict**). The dispatch also carries `REPO=<owner>/<name>` and `PR=<number>` lines for grep. Post the review body as an `event=COMMENT` review per the `review-output.md` invariant — never `APPROVE`/`CHANGES_REQUESTED`. Round-2 hygiene first: if you posted a prior bot review on this PR, minimize it (`OUTDATED`) and resolve its threads before posting the new one (target `nv-slang-bot` only).

   ```bash
   DISPATCH="$(cat /workspace/agent/.dispatch.txt 2>/dev/null || true)"
   if echo "$DISPATCH" | grep -q "<github-post-authorized />"; then
     REPO=$(echo "$DISPATCH" | grep -oE "^REPO=[^[:space:]]+" | head -1 | cut -d= -f2)
     PR=$(echo "$DISPATCH" | grep -oE "^PR=[0-9]+" | head -1 | cut -d= -f2)
     BODY_FILE="/workspace/agent/review-${REPO//\//-}-$PR.md"
     [ -n "$REPO" ] && [ -n "$PR" ] && [ -s "$BODY_FILE" ] && \
       jq -Rsn --arg b "$(cat "$BODY_FILE")" '{body:$b, event:"COMMENT"}' \
         | gh api "repos/$REPO/pulls/$PR/reviews" --method POST --input - --jq '.html_url'
   fi
   ```

   Report result to parent: posted (with URL) / 403 → no `pull_requests:write`, fell back to `send_file` / any other failure (review already sent via **Write + report the verdict**).

## Mode invariants

- **Produce, then gate the post.** **Write + report the verdict** always writes + sends the review; **Post review back to GitHub** decides GitHub posting from the marker. No marker ⇒ `send_file` only.
- **Bot reviews are always `event=COMMENT`** — never APPROVE / CHANGES_REQUESTED (see `review-output.md`). Bots don't gate human merges.
- **Round-2 hygiene.** Re-reviewing a PR minimizes the prior `nv-slang-bot` review `OUTDATED` and resolves its threads BEFORE posting the new one. Never touch human / other-bot reviews.
- **403 = graceful degrade.** No `pull_requests:write` → post fails → fall back to `send_file`. Affects `slang-coworkers/*`; `shader-slang/*` are write-capable.
- **Patch mode never posts** — no PR to post to; return via `send_file` only.
- **Single reviewer, by design.** Unlike the slang `slang-pr-review` workflow (three reviewers + runner skills), this reviews directly with subagents. Escalate compiler-side concerns (codegen, target-specific) by flagging `escalate-to-slang` in the verdict — SlangPy reviewers don't own Slang-compiler correctness.

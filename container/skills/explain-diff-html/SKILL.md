---
name: explain-diff-html
license: MIT
description: "Rich, self-contained HTML explanation of a code change (PR, branch, or diff): Background → Intuition → Code walkthrough → five-question interactive quiz. On a PR the same content becomes the PR description, rewritten for the current head on every push. Run it right after every `gh pr create` (the PR-created hook asks for it), after every push to a PR you own (the push hook reminds you), and whenever someone asks for a deep explanation of a change."
provides: [pr.explain]
allowed-tools: Bash(git:*), Bash(gh:*), Bash(date:*), Bash(wc:*), Bash(python3:*), Read, Grep, Glob, Write, mcp__nanoclaw__send_file, mcp__nanoclaw__send_message
---

# Explain a diff as HTML

Produce one self-contained HTML page that teaches a reader what a change does and why, well enough that they could review it. The reader may be the peer reviewer, the orchestrator, or a human who was not in the loop. On a PR, the same content, rendered in GitHub-safe markup, **is the PR description**: the first thing a reviewer reads, always describing the PR's current head.

## When

- **After every PR you create.** The PR-created hook context names the PR (`owner/repo#N`). Call `report_pr_created` first, then run this skill, then send the review request / report with the file path in its artifact list. The explanation is part of opening a PR, not an optional extra.
- **After every push to a PR you own.** A fix round, a review-driven rewrite, an amended design: re-run against the new head and rewrite the description (see *The PR description*). The push hook reminds you with the pushed head. Skip only a push that changes nothing a reader would notice (typo, rebase with no content change), and then say so in your report.
- **After anything else rewrites the description.** A workflow that edits the PR body (`gh pr edit --body`, a PATCH to `pulls/<n>`) replaces the explanation; re-run so the description is the explanation again.
- **On request.** "Explain this PR / branch / diff" from anyone in the chain.

## Scope the change

```bash
gh pr view <n> --repo <owner/repo> --json title,body,baseRefName,headRefName,headRefOid,additions,deletions,files
gh pr diff <n> --repo <owner/repo>                      # or: git diff <base>...<head>
```

Then read the surrounding code in your checkout — the modules the diff touches, their callers, the tests. Background needs the system as it was, not just the hunks.

## Sections, in this order

1. **Background.** The existing system relevant to this change. Two layers: a deep background for a beginner (marked as skippable), then a narrow background directly relevant to the change.
2. **Intuition.** The essence of the change, not the details. Concrete examples with toy data. Figures and diagrams throughout.
3. **Code.** A high-level walkthrough of the diff, grouped and ordered so it reads as a story rather than file by file.
4. **Quiz.** Five multiple-choice questions of medium difficulty: answerable only by someone who understood the substance, never gotchas. Clicking an option reveals correct/incorrect and a one-paragraph explanation.
   - **Spread the correct answers.** Left alone, the correct option lands first almost every time, and the quiz tests nothing. Before writing it, get the correct-answer letter for each question from the head and place the correct option there:

     ```bash
     python3 /home/node/.claude/skills/explain-diff-html/scripts/upsert_pr_body.py --quiz-positions --head "$(git -C <worktree> rev-parse HEAD)"   # e.g. "C A D B C"
     ```

     Use `--questions 3 --options 3` for a compact quiz. The distractors fill the other slots.

## Format (the HTML file)

- One HTML file with inline CSS and JavaScript, no external assets, works offline. One long page with section headers and a table of contents at the top. No tabs for the top-level structure. Basic responsive styling so it reads on a phone.
- Write with the clarity and flow of Martin Kleppmann: engaging, classic style, smooth transitions between sections.
- Diagrams: pick a small number of diagram families and reuse them across cases. Useful families: a very simplified version of the UI the user sees; a system diagram of data flow between components **with example data in it**.
- No ASCII diagrams. Diagrams are simple HTML/CSS; lists are HTML lists.
- Code goes in `<pre>`. If a styled `<div>` holds code it must carry `white-space: pre-wrap`, or the browser collapses the newlines. Before saving, scan every code block in the source and confirm `white-space: pre` or `pre-wrap` applies.
- Callouts for key concepts, definitions, and important edge cases.
- The quiz script also shuffles each question's options when the page loads (Fisher–Yates over the option elements; correctness lives in a `data-correct` attribute, never in position), so even a hand-edited quiz never puts every answer first.

## Where it goes

```
/workspace/agent/reports/pr-explanations/<YYYY-MM-DD>-<owner>-<repo>-pr<N>-<slug>.html   # PR
/workspace/agent/reports/pr-explanations/<YYYY-MM-DD>-<branch-slug>.html                 # no PR yet
```

`date +%F` for the prefix (files stay time-sorted); `<slug>` is 2–5 lowercase words from the title. On a re-run for a new round, write a new dated file (the old one stays as the record of the earlier head). The directory sits outside every git checkout: never commit it, never `git add` it.

## The PR description

On a PR, the explanation replaces the PR description. GitHub renders Markdown plus a sanitized subset of HTML. Everything that makes the HTML file rich — `<style>`, `<script>`, `style=""` attributes, `<iframe>` — is stripped, so the description is a **re-rendering of the same sections in GitHub-safe markup**, not the file pasted in.

Rules for the explanation Markdown (write it to `/tmp/explain-body.md`; the script adds the section markers):

1. First line: `## 📖 Explanation — head <sha7> · <YYYY-MM-DD>`. Then Background, Intuition, Code walkthrough as `###` sections, visible, not collapsed: this is the description.
2. The deep-background layer goes in one `<details><summary>Deep background (skippable)</summary>` block, and the whole quiz goes in one `<details><summary>Quiz — five questions</summary>` block at the end. Leave a blank line after `</summary>` and before `</details>`, or GitHub will not process the Markdown inside.
3. Use **Markdown, not raw HTML**, for structure: `###` headings, lists, tables, fenced code. Raw-HTML blocks switch Markdown processing off inside them. Allowed HTML you may still use: `<details>`/`<summary>` (nested), `<b>`, `<i>`, `<code>`, `<kbd>`, `<sub>`, `<sup>`, `<br>`, `<blockquote>`.
4. **Diagrams** become fenced ```` ```mermaid ```` blocks (GitHub renders Mermaid natively, including inside `<details>`); a plain fenced text block is the fallback. Never inline SVG or CSS boxes — they collapse to text.
5. **Quiz**: numbered questions, options as a lettered list (`A.`–`D.`) in the order `--quiz-positions` gave you, and the answer letter plus its one-paragraph rationale in a nested `<details><summary>Answer</summary>` per question (the click-to-reveal JavaScript cannot run on GitHub).
6. **Do not** put the internal viewer URL or the `/workspace/agent/reports/...` path in the description — the file stays internal; the description carries the content.

Write it with the script. It rewrites the description and nothing else, and it enforces the rest:

```bash
R=<owner/repo>; N=<n>; WT=<worktree the explanation was written from>
python3 /home/node/.claude/skills/explain-diff-html/scripts/upsert_pr_body.py \
  --repo "$R" --pr "$N" --head "$(git -C "$WT" rev-parse HEAD)" --explanation /tmp/explain-body.md
```

- **Head check.** It refuses (exit 4) when the PR's live head is not the commit you explained: push first, or re-run on the current head. A stale explanation never overwrites a newer one.
- **Where the chain's status goes.** The description no longer carries the rolled-up 5-bullet: post it on the issue (`fix in draft PR #N, held pending review` when draft-held), as chain reporting already asks for a draft PR.
- **What survives from the old description.** Issue links (`Fixes #N`, `Closes owner/repo#N`, `Part of #N`, `Refs #N`) and the bot disclaimer line, below the explanation, so auto-close, the chain's PR→issue mapping, and the disclaimer keep working. Everything else is replaced. Put anything else that must stay on the PR (a status note for the maintainer, a question) in a comment or in the explanation itself.
- **Size.** Over 60,000 characters exits 3 (GitHub rejects bodies over 65,536): drop the deep-background layer first, then compress the code walkthrough to its story; never drop the quiz.
- **Legacy comment.** A PR that still has the old collapsed explanation comment gets it replaced with a one-line pointer to the description.
- `--dry-run` prints the new description without writing it.

Writing the description is unconditional for PRs you own. If `gh` fails (exit 5, e.g. 403), say so in one line in your report and move on — the HTML file and the thread delivery are still owed.

## Deliver

1. `mcp__nanoclaw__send_file({ path, text: "Explanation of <owner/repo>#<N> — <title> (head <sha7>)" })` to the thread that asked for the PR (`in_reply_to` the request when you are on a chain). If the channel cannot take a file, say so in one line and give the path.
2. Rewrite the PR description as above. Mention "PR description updated for head <sha7>" with the PR URL in the report that follows.
3. Put the file path in the artifact list of the review request / `[Fix Report]` / handoff that follows, so the reviewer opens it before the diff.
4. **Never** post the file itself, its path, or any internal viewer URL to GitHub. Upstream PRs are public; the content is fine to share, the internal locations are not.

## Effort

One focused pass: read for background, write, verify the checklist, deliver. Do not re-run tests or re-review the code here — that is the critique's job. For a docs-only or under-20-line diff, keep Background short and say "compact" in the header; the quiz can be three questions. A round re-run reuses the previous explanation's structure and rewrites only what the new head changed.

## Before you send

- Table of contents anchors resolve; the page is one scroll.
- Every code block keeps its newlines (`<pre>` or `pre-wrap` confirmed in the source).
- Each quiz option responds with correct/incorrect and feedback.
- No `http(s)://` asset references; the file opens from disk.
- Quiz: the correct answers sit at the `--quiz-positions` letters (not all in one position); the HTML shuffles options on load.
- PR description: first line is the `## 📖 Explanation — head <sha7> · <date>` heading; deep background and the quiz are in closed `<details>` blocks with blank lines after `<summary>` and before `</details>`; no `<style>`, `<script>`, or `style=` anywhere; diagrams are Mermaid or text fences; the script exited 0 (not 3 or 4) and reported the head you explained.

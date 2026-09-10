---
name: explain-diff-html
license: MIT
description: "Rich, self-contained HTML explanation of a code change (PR, branch, or diff): Background → Intuition → Code walkthrough → five-question interactive quiz, plus the same content posted on the PR as one collapsed comment that is updated in place on every push. Run it right after every `gh pr create` (the PR-created hook asks for it), after every new round you push to a PR you own, and whenever someone asks for a deep explanation of a change."
provides: [pr.explain]
allowed-tools: Bash(git:*), Bash(gh:*), Bash(date:*), Bash(wc:*), Read, Grep, Glob, Write, mcp__nanoclaw__send_file, mcp__nanoclaw__send_message
---

# Explain a diff as HTML

Produce one self-contained HTML page that teaches a reader what a change does and why, well enough that they could review it. The reader may be the peer reviewer, the orchestrator, or a human who was not in the loop. The same content, rendered in GitHub-safe markup, goes on the PR as a single collapsed comment so reviewers on GitHub get it without leaving the PR.

## When

- **After every PR you create.** The PR-created hook context names the PR (`owner/repo#N`). Call `report_pr_created` first, then run this skill, then send the review request / report with the file path in its artifact list. The explanation is part of opening a PR, not an optional extra.
- **After every round you push to a PR you own.** A fix round, a review-driven rewrite, an amended design: re-run against the new head and update the PR comment in place (see *Post to the PR*). One explanation comment per PR, always describing the current head. Skip the re-run for pushes that change nothing a reader would notice (typo, rebase with no content change).
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

## Format (the HTML file)

- One HTML file with inline CSS and JavaScript, no external assets, works offline. One long page with section headers and a table of contents at the top. No tabs for the top-level structure. Basic responsive styling so it reads on a phone.
- Write with the clarity and flow of Martin Kleppmann: engaging, classic style, smooth transitions between sections.
- Diagrams: pick a small number of diagram families and reuse them across cases. Useful families: a very simplified version of the UI the user sees; a system diagram of data flow between components **with example data in it**.
- No ASCII diagrams. Diagrams are simple HTML/CSS; lists are HTML lists.
- Code goes in `<pre>`. If a styled `<div>` holds code it must carry `white-space: pre-wrap`, or the browser collapses the newlines. Before saving, scan every code block in the source and confirm `white-space: pre` or `pre-wrap` applies.
- Callouts for key concepts, definitions, and important edge cases.

## Where it goes

```
/workspace/agent/reports/pr-explanations/<YYYY-MM-DD>-<owner>-<repo>-pr<N>-<slug>.html   # PR
/workspace/agent/reports/pr-explanations/<YYYY-MM-DD>-<branch-slug>.html                 # no PR yet
```

`date +%F` for the prefix (files stay time-sorted); `<slug>` is 2–5 lowercase words from the title. On a re-run for a new round, write a new dated file (the old one stays as the record of the earlier head). The directory sits outside every git checkout: never commit it, never `git add` it.

## Post to the PR (collapsed comment)

GitHub renders Markdown plus a sanitized subset of HTML. Everything that makes the HTML file rich — `<style>`, `<script>`, `style=""` attributes, `<iframe>` — is stripped, so the PR variant is a **re-rendering of the same sections in GitHub-safe markup**, not the file pasted in.

Rules for the comment body (write it to `/tmp/explain-comment.md`):

1. First line is the hidden marker the upsert keys on: `<!-- explain-diff-html <owner/repo>#<N> -->`.
2. Wrap everything in one `<details>` block, **closed by default** (no `open` attribute):

   ```
   <details>
   <summary>📖 Explanation of this PR — background · intuition · code walkthrough · quiz (head <sha7>, <YYYY-MM-DD>)</summary>

   ### Background
   …Markdown…

   </details>
   ```

   Leave a blank line after `</summary>` and before `</details>`, or GitHub will not process the Markdown inside.
3. Inside the block use **Markdown, not raw HTML**, for structure: `###` headings, lists, tables, fenced code. Raw-HTML blocks switch Markdown processing off inside them. Allowed HTML you may still use: `<details>`/`<summary>` (nested), `<b>`, `<i>`, `<code>`, `<kbd>`, `<sub>`, `<sup>`, `<br>`, `<blockquote>`.
4. **Diagrams** become fenced ```` ```mermaid ```` blocks (GitHub renders Mermaid natively, including inside `<details>`); a plain fenced text block is the fallback. Never inline SVG or CSS boxes — they collapse to text.
5. **Quiz**: numbered questions, options as a list, and the answer plus its one-paragraph rationale in a nested `<details><summary>Answer</summary>` per question (the click-to-reveal JavaScript cannot run on GitHub).
6. **Size**: the whole body must stay under 60,000 characters (GitHub rejects comments over 65,536). Check with `wc -c /tmp/explain-comment.md`. If over: drop the deep-background layer first, then compress the code walkthrough to its story; never drop the quiz.
7. **Do not** put the internal viewer URL or the `/workspace/agent/reports/...` path in the comment — the file stays internal; the comment carries the content.

Upsert — one comment per PR, edited in place on every re-run:

```bash
R=<owner/repo>; N=<n>
CID=$(gh api "repos/$R/issues/$N/comments" --paginate \
        --jq '.[] | select(.body | startswith("<!-- explain-diff-html ")) | .id' | head -n1)
if [ -n "$CID" ]; then
  gh api -X PATCH "repos/$R/issues/comments/$CID" -F body=@/tmp/explain-comment.md >/dev/null   # update in place
else
  gh pr comment "$N" --repo "$R" --body-file /tmp/explain-comment.md                             # first post
fi
```

Posting is unconditional for PRs on repositories you are allowed to comment on (your own fork PRs, the project's upstream PRs you opened). If `gh` returns 403, say so in one line in your report and move on — the HTML file and the thread delivery are still owed.

## Deliver

1. `mcp__nanoclaw__send_file({ path, text: "Explanation of <owner/repo>#<N> — <title> (head <sha7>)" })` to the thread that asked for the PR (`in_reply_to` the request when you are on a chain). If the channel cannot take a file, say so in one line and give the path.
2. Post (or update) the collapsed PR comment as above. Mention "explanation comment posted/updated" with the comment URL in the report that follows.
3. Put the file path in the artifact list of the review request / `[Fix Report]` / handoff that follows, so the reviewer opens it before the diff.
4. **Never** post the file itself, its path, or any internal viewer URL to GitHub. Upstream PRs are public; the content is fine to share, the internal locations are not.

## Effort

One focused pass: read for background, write, verify the checklist, deliver. Do not re-run tests or re-review the code here — that is the critique's job. For a docs-only or under-20-line diff, keep Background short and say "compact" in the header; the quiz can be three questions. A round re-run reuses the previous explanation's structure and rewrites only what the new head changed.

## Before you send

- Table of contents anchors resolve; the page is one scroll.
- Every code block keeps its newlines (`<pre>` or `pre-wrap` confirmed in the source).
- Each quiz option responds with correct/incorrect and feedback.
- No `http(s)://` asset references; the file opens from disk.
- PR comment: starts with the marker line; one closed `<details>` wrapper with blank lines after `<summary>` and before `</details>`; no `<style>`, `<script>`, or `style=` anywhere; diagrams are Mermaid or text fences; under 60,000 characters; the upsert found and edited the existing comment when the PR already had one.

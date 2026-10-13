---
name: explain-diff-html
license: MIT
description: "Rich, self-contained HTML explanation of a code change (PR, branch, or diff): Background → Intuition → Code walkthrough → five-question interactive quiz. On a PR the same content becomes the PR's explanation comment (one marker-identified comment, usually after the bots' first comments), rewritten for the current head on every push; the description itself stays concise. Run it right after every `gh pr create` (the PR-created hook asks for it), after every push to a PR you own (the push hook reminds you), and whenever someone asks for a deep explanation of a change."
provides: [pr.explain]
allowed-tools: Bash(git:*), Bash(gh:*), Bash(date:*), Bash(wc:*), Bash(python3:*), Read, Grep, Glob, Write, mcp__nanoclaw__send_file, mcp__nanoclaw__send_message
---

# Explain a diff as HTML

One self-contained HTML page that teaches a reader — the peer reviewer, the orchestrator, or a human who was not in the loop — what a change does and why, well enough to review it. On a PR, the same content in GitHub-safe markup lives in **one explanation comment**, found by its marker, not its position (on a busy repo it lands after the bots' first comments), always describing the PR's current head. The description stays the concise summary (*The PR description*): squash merges copy it into git log.

## When

| Situation | Action |
|---|---|
| You created a PR (the PR-created hook names `owner/repo#N`) | Call `report_pr_created` first, then run this skill, then send the review request / report with the file path in its artifact list. |
| You pushed to a PR you own (the push hook names the head) | Re-run against the new head and rewrite the comment. For a push that changes nothing a reader would notice (typo, rebase with no content change), re-run `upsert_pr_body.py` on the new head with the previous explanation (its head line updated) and say so in your report. |
| Anyone in the chain asks "explain this PR / branch / diff" | Run it. |

Where the critique gate is on, the refresh is enforced: until `upsert_pr_body.py` has written the comment for the head you last pushed (or the PR you just opened), a Stop hook holds your turn open once and `[Fix Review Request]` / `[Fix Report]` are refused naming the PR. Editing the description (`gh pr edit --body`) never touches the comment.

## Scope the change

```bash
gh pr view <n> --repo <owner/repo> --json title,body,baseRefName,headRefName,headRefOid,additions,deletions,files
gh pr diff <n> --repo <owner/repo>                      # or: git diff <base>...<head>
```

Then read the surrounding code in your checkout — the modules the diff touches, their callers, the tests. Background needs the system as it was, not just the hunks.

## Sections, in this order

1. **Background.** The existing system relevant to this change: a deep layer for a beginner (marked skippable), then the narrow background the change needs.
2. **Intuition.** The essence of the change, not the details; concrete examples with toy data; figures and diagrams throughout.
3. **Code.** A high-level walkthrough of the diff, grouped and ordered as a story, not file by file.
4. **Quiz.** Five medium-difficulty multiple-choice questions answerable only by someone who understood the substance, never gotchas. Clicking an option reveals correct/incorrect and a one-paragraph explanation. Left alone, the correct option lands first almost every time, so get each question's correct-answer letter from the head and place the correct option there (`--questions 3 --options 3` for a compact quiz; the distractors fill the other slots):

   ```bash
   python3 /home/node/.claude/skills/explain-diff-html/scripts/upsert_pr_body.py --quiz-positions --head "$(git -C <worktree> rev-parse HEAD)"   # e.g. "C A D B C"
   ```

## Format (the HTML file)

- One file with inline CSS and JavaScript, no external assets, works offline; one long page with section headers and a table of contents at the top (no top-level tabs); basic responsive styling so it reads on a phone.
- Write with the clarity and flow of Martin Kleppmann: engaging, classic style, smooth transitions between sections.
- Diagrams: a few diagram families reused across cases — a very simplified version of the UI the user sees; a system diagram of data flow between components **with example data in it**. Simple HTML/CSS, never ASCII art; lists are HTML lists.
- Code goes in `<pre>`; a styled `<div>` holding code carries `white-space: pre-wrap`, or the browser collapses the newlines. Before saving, confirm `white-space: pre` or `pre-wrap` applies to every code block in the source.
- Callouts for key concepts, definitions and important edge cases.
- The quiz script shuffles each question's options on load (Fisher–Yates over the option elements; correctness lives in a `data-correct` attribute, never in position), so even a hand-edited quiz never puts every answer first.

## Where it goes

```
/workspace/agent/reports/pr-explanations/<YYYY-MM-DD>-<owner>-<repo>-pr<N>-<slug>.html   # PR
/workspace/agent/reports/pr-explanations/<YYYY-MM-DD>-<branch-slug>.html                 # no PR yet
```

`date +%F` for the prefix (files stay time-sorted); `<slug>` is 2–5 lowercase words from the title. A re-run for a new round writes a new dated file (the old one records the earlier head). The directory sits outside every git checkout: never commit it, never `git add` it.

## The explanation comment

GitHub renders Markdown plus a sanitized subset of HTML — `<style>`, `<script>`, `style=""` attributes and `<iframe>` are stripped — so the comment is a **re-rendering of the same sections in GitHub-safe markup**, not the file pasted in. Write it to `/tmp/explain-body.md`; the script adds the comment marker, the seal and, when missing, the bot disclaimer.

1. First line `## 📖 Explanation — head <sha7> · <YYYY-MM-DD>`; then Background, Intuition, Code walkthrough as visible `###` sections.
2. The deep-background layer in one `<details><summary>Deep background (skippable)</summary>` block; the whole quiz in one `<details><summary>Quiz — five questions</summary>` block at the end. Leave a blank line after `</summary>` and before `</details>`, or GitHub will not process the Markdown inside.
3. **Markdown, not raw HTML**, for structure (`###` headings, lists, tables, fenced code): raw-HTML blocks switch Markdown processing off inside them. Allowed HTML: `<details>`/`<summary>` (nested), `<b>`, `<i>`, `<code>`, `<kbd>`, `<sub>`, `<sup>`, `<br>`, `<blockquote>`.
4. **Diagrams** as fenced ```` ```mermaid ```` blocks (GitHub renders Mermaid natively, also inside `<details>`); a plain fenced text block is the fallback. Never inline SVG or CSS boxes — they collapse to text.
5. **Quiz**: numbered questions, options as a lettered list (`A.`–`D.`) in the order `--quiz-positions` gave you, and the answer letter plus its one-paragraph rationale in a nested `<details><summary>Answer</summary>` per question (click-to-reveal JavaScript cannot run on GitHub).
6. No internal viewer URL or `/workspace/agent/reports/...` path (*Deliver*, rule 4).

```bash
R=<owner/repo>; N=<n>; WT=<worktree the explanation was written from>
python3 /home/node/.claude/skills/explain-diff-html/scripts/upsert_pr_body.py \
  --repo "$R" --pr "$N" --head "$(git -C "$WT" rev-parse HEAD)" --explanation /tmp/explain-body.md
```

What the script enforces. Exit 0 means written; any failed write exits 5 and a head that moved during the run exits 4, both without a receipt — re-run.

| Rule | Behaviour |
|---|---|
| Head check | Exit 4 when the PR's live head is not the commit you explained: push first, or re-run on the current head. A stale explanation never overwrites a newer one. |
| One comment | Edits our comment in place or creates it, then re-reads the comments and succeeds only when exactly one of ours carries your explanation for your head. A comment is ours when it starts with the marker for this exact PR **and** its author is an identity this coworker has proven it writes as: the `gh api user` login, a login GitHub returned for one of the script's own posts (remembered in `~/.claude/explain-diff-actors.json`), or one you name in `EXPLAIN_DIFF_ACTOR`. Someone else's comment starting with our marker → exit 5 naming it: set `EXPLAIN_DIFF_ACTOR=<login>` only when that login is this coworker's own identity, never a human's; otherwise tell your parent. Our older collapsed comment is converted, not duplicated; extra copies of ours become a one-line pointer to the kept one. |
| Human edits | Every body it writes ends in a seal line (sha256 of the text above it). A comment of ours whose seal no longer matches, or that GitHub's edit history shows edited by anyone but us, is never overwritten: exit 5 with a `NOTE:` naming the editor and no write. Tell your parent; a human reverts the edit or deletes the comment to let the refresh resume. Never edit or delete it yourself. |
| Disclaimer | Appends the bot disclaimer `<sub>…</sub>` line when the explanation has none: `--disclaimer` / `EXPLAIN_DIFF_DISCLAIMER`, else the description's own last `<sub>` line, else a generic one. Prints a `NOTE:` when the description lacks it. |
| Description | Removes the explanation block an earlier version wrote into the description only when it is exactly that block (the start marker for this PR as the very first line, through the one end-marker line) and a real description remains (200+ characters with a Summary section). Anything else — an indented or later example, two end markers, a missing end, too little left — stays, with a `NOTE:`: move it out or write the concise description with `gh pr edit <n> --body-file <file>`, which replaces the whole description, block included. A description under 200 characters or over the limits in *The PR description* gets a `NOTE:` too. |
| Size | Over 60,000 characters exits 3 (GitHub rejects comments over 65,536): drop the deep-background layer first, then compress the code walkthrough to its story; never drop the quiz. |
| `--dry-run` | Writes nothing; prints the comment's first three lines, its character count, the plan JSON and the `NOTE:` lines to stderr (`--quiet` drops the preview). Its stdout is never a receipt. |

Writing the comment is unconditional for PRs you own. If `gh` fails (exit 5, e.g. 403), say so in one line in your report and move on — the HTML file and the thread delivery are still owed. The chain's status (the rolled-up 5-bullet; `fix in draft PR #N, held pending review` when draft-held) goes on the issue, as chain reporting already asks.

## The PR description

Squash merges copy the description into git log, so it is the commit message maintainers will live with: what changed, why, how it was tested, the issue links (`Fixes #N`, `Part of #N`) and the bot disclaimer as the last line — never the explanation, the quiz or diagrams. Write it with `gh pr create --body-file`; update it with `gh pr edit <n> --body-file <file>` when the change itself changes. On a PR whose description still holds an old explanation block, write the concise description first (or right after the script's `NOTE:`).

The limits, stated here once. The PreToolUse gate (`container/hooks/lib/pr_description.py`) refuses a `gh pr create`, `gh pr edit` or `gh api …/pulls` that breaks them with one line naming what is over, and the script above prints a `NOTE:` for a description already over them:

- **2 lines per section.** A section starts at a line with a bold label (`**Summary.**`) or a `## Heading` and holds at most 2 non-empty lines, the label line included; blank lines do not end a section.
- **1,000 characters in total**, not counting the final `<sub>` disclaimer line and `Fixes|Closes|Resolves #N` lines.
- **No tables.** Tables, per-case details and long risk lists go in the explanation comment.
- **Open questions are one line:** `Open question (blocks merge): <the question> — details in the explanation comment.`

Pre-check a description offline before `gh pr edit`: `cd /home/node/.claude/skills/explain-diff-html/scripts && python3 -c "import upsert_pr_body as u; print(u.description_problems(open('<file>').read(), 1000, 2))"` prints `[]` when it passes.

## Deliver

1. `mcp__nanoclaw__send_file({ path, text: "Explanation of <owner/repo>#<N> — <title> (head <sha7>)" })` to the thread that asked for the PR (`in_reply_to` the request when you are on a chain). If the channel cannot take a file, say so in one line and give the path.
2. Update the explanation comment as above; the report that follows says "Explanation comment updated for head <sha7>" with the comment URL.
3. Put the file path in the artifact list of the review request / `[Fix Report]` / handoff that follows, so the reviewer opens it before the diff.
4. **Never** post the file itself, its path, or any internal viewer URL to GitHub. Upstream PRs are public; the content is fine to share, the internal locations are not.

## Effort

One focused pass: read for background, write, verify the checklist, deliver. Do not re-run tests or re-review the code here — that is the critique's job. A docs-only or under-20-line diff gets a short Background marked "compact" and may use a three-question quiz. A round re-run keeps the previous explanation's structure and rewrites only what the new head changed.

## Before you send

Re-check *Format* (table of contents anchors resolve, the page is one scroll, every code block keeps its newlines, each quiz option responds and the options shuffle on load, no `http(s)://` asset references), *The explanation comment* rules 1–6 with the correct answers at the `--quiz-positions` letters, the script's exit 0 and the head it reported, and *The PR description* limits with no `NOTE:` left unanswered.

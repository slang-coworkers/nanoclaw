### Review output rules

Apply when posting review output back to GitHub (slangpy-reviewer only — fixers/writers/triagers don't post reviews).

- **Bot reviews are always `event=COMMENT`.** Never `APPROVE` or `CHANGES_REQUESTED` — bots must not gate human merges. Post the review body with `gh api … --method POST` using `event=COMMENT`; never submit any other state.
- **Post only when authorized.** The `/slangpy-pr-review` workflow posts the review to GitHub ONLY when the orchestrator's dispatch carries the `<github-post-authorized />` marker — set when a human tagged `@nv-slang-bot` in the triggering comment (an explicit invitation to reply). Without the marker — chat invocation, internal coworker handoff, scheduled task — return via `send_file` only.
- **Round-2 hygiene before post.** Before posting a new review on a PR you already reviewed, minimize your prior bot review/comment (edit it to note it is `OUTDATED`) and resolve the prior bot threads first — a second review piled on the first is noise. Target `nv-slang-bot` comments only; never touch a human's or another bot's review.
- **403 = graceful degrade.** If the App installation token lacks `pull_requests:write` on the target repo, the post fails — fall back to `send_file` only so the human still has the review via the parent thread. Affects `slang-coworkers/*` today; `shader-slang/*` repos are write-capable.

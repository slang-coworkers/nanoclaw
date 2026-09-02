---
name: hermes-review
type: workflow
description: 'Adversarial peer review of a hermes-builder draft PR in the Hermes fork: check out the PR head in your own worktree, re-run hermes plugins doctor --ci, the acceptance test and tests/plugins/ yourself, enforce the plugin-first boundary, and return [Review Verdict] on the builder''s edge. Extends plan (mode = review); read-only, no push, no GitHub writes.'
extends: plan
requires: [issues.read, code.read, doc.read]
uses:
  skills: [hermes-code-reader, hermes-github, hermes-build]
  workflows: []
overrides:
  research: |
    **Research** — Never trust the builder's log. Re-run everything in your own worktree, from the PR head SHA.

    1. **Inputs.** The review request is an inbound from `hermes-builder` — round 1 arrives as unmarked text (`Fix review request — <fork-slug>#<N>: …`), later rounds as `[Fix Review Request]`. Record `<review-request-id>` (the inbound id) — the verdict MUST reply to it. Read the attached ADR under `/workspace/inbox/<msg-id>/`. No status echoes to anyone.
    2. **Pin the head, own worktree only:**
       ```bash
       FORK=<fork remote URL from /hermes-github — the fork, never https://github.com/{{vars.repo}}>
       [ -d /workspace/agent/hermes-agent/.git ] || git clone "$FORK" /workspace/agent/hermes-agent
       cd /workspace/agent/hermes-agent && git fetch origin
       gh pr view <N> --repo <fork-slug> --json headRefOid,headRefName,baseRefName,isDraft,url --jq '.'   # record HEAD_SHA, BASE; isDraft must be true
       git fetch origin "pull/<N>/head:review/<N>"
       git worktree add /workspace/agent/wt-review-<N> review/<N>
       cd /workspace/agent/wt-review-<N> && git rev-parse HEAD                                          # must equal HEAD_SHA — the verdict binds to it
       ```
       **[MUST NOT]** read, write, or remove any sibling `wt-*` directory (the builder's worktrees live on the same volume). If the head moves mid-review, restart from this step.
    3. **Environment — `Agent` subagent, once per worktree, never inline:** `uv sync --locked --python /usr/bin/python3 --extra dev` (log to `/workspace/agent/build/uv-sync-review-<N>.log`; never `uv python install`; run it OUTSIDE `scripts/run_tests.sh`, which strips the proxy env under `env -i`). `export HERMES_HOME=/workspace/agent/.hermes-testbed` for every `hermes` CLI call.
    4. **Scope check first (cheap, decisive):**
       ```bash
       git diff --name-only origin/<BASE>...HEAD | awk '!/^(plugins\/|website\/docs\/|tests\/)/' > /workspace/agent/reviews/<N>-out-of-scope.txt
       ```
       Every path listed is a core edit. Open the ADR's `## CORE-CHANGE` section: it must cite `{{vars.release_tree}}/<file>:<line>`; open that line in the release tree and confirm it genuinely blocks a plugin and that the diff is the minimal GENERIC widening described (new hook / `ctx` method / config key — not a special case for this plugin). Missing, wrong, or over-broad → record a **must-change** now.
    5. **Re-run, in this order, and keep the raw output for the report:**
       ```bash
       cd /workspace/agent/wt-review-<N> && export HERMES_HOME=/workspace/agent/.hermes-testbed
       .venv/bin/hermes plugins doctor plugins/<name> --ci ; echo doctor_exit=$?              # a. exit 0
       scripts/run_tests.sh tests/plugins/test_<plugin>_acceptance.py                            # b. PASS
       uv run ruff check plugins/<name> tests/plugins/test_<plugin>_acceptance.py ; echo ruff_exit=$?   # c. clean (blocking in CI)
       python3 scripts/check-windows-footguns.py ; echo footguns_exit=$?                           # d. clean
       ```
       e. `scripts/run_tests.sh tests/plugins/ tests/hermes_cli/` in an `Agent` subagent with an explicit Bash `timeout` (log to `/workspace/agent/build/review-<N>-focused.log`; never `run_in_background`).
       f. **Negative control — does the test actually test the plugin?** `git worktree add /workspace/agent/wt-review-<N>-base origin/<BASE>`, `cp tests/plugins/test_<plugin>_acceptance.py` into it, run `scripts/run_tests.sh` on it there (reuse the venv via `UV_PROJECT_ENVIRONMENT`/`.venv` symlink or a second `uv sync` in a subagent) — it must FAIL on the base tree. A test that passes without the plugin is a **must-change**.
       g. If the ADR names a CLI smoke: `.venv/bin/hermes plugins enable <key>` and the named command against the testbed `HERMES_HOME`.
    6. **Read the diff with these lenses** (cite the violated rule at its `{{vars.release_tree}}/AGENTS.md:<line>` or `website/docs/developer-guide/plugins/index.md:<line>`): plugin contract — `plugin.yaml` has `manifest_version: 1`, `name`/`version`/`description`, `provides_hooks`/`provides_tools` equal to what `register(ctx)` registers, hook callbacks accept `**kwargs`, tool handlers `(args: dict, **kwargs) -> str` return JSON and never raise, state via `plugin_storage`, settings via `plugins.entries.<id>.settings`; no new `HERMES_*` env for non-secret config; `get_hermes_home()` not `~/.hermes`; behavior-contract tests only (no snapshots / model lists / version literals / enumeration counts / source reading / `~/.hermes` writes; OS markers not bare `skipif`); cross-platform (`shutil.which`, `psutil`, `pathlib`); ruff ASYNC rules in `plugins/**`; deps pinned `>=floor,<next_major` with `uv.lock` regenerated (and a dep change is itself a CORE-CHANGE); prompt-caching untouched (no mid-conversation mutation of context/toolsets/system prompt); one logical change; Conventional Commit; docs under `website/docs/` for user-visible behaviour; PR is a **draft** against the **fork** (never {{vars.repo}}); scope matches the requirement's acceptance criterion — flag scope shrinkage.

    DeepWiki (`mcp__deepwiki__ask_question("NousResearch/hermes-agent", …)`) is advisory for architecture context only; the release tree is the sole citation source. Stay read-only: never push, never edit the PR branch, never comment on GitHub.
  diagnose: |
    **Synthesize** — Mode is always `review`: findings by severity, each with `<file>:<line>` in the PR diff and the rule it violates.

    - **must-change** (any one → `REQUEST_CHANGES`): a diff outside `plugins/**`, `website/docs/**`, `tests/**` without a valid ADR `## CORE-CHANGE` citation of `{{vars.release_tree}}/<file>:<line>` (or with a citation that does not actually block a plugin, or a change broader than the generic widening); a plugin special-cased in core; `hermes plugins doctor --ci` non-zero; acceptance test failing on the head or PASSING on the base tree (negative control); tests that read source, snapshot enumerations, or write `~/.hermes`; hook callback without `**kwargs` or handler that raises; new `HERMES_*` env var for non-secret config; hardcoded `~/.hermes`; unpinned/unbounded dependency or missing `uv.lock` regen; PR opened against {{vars.repo}} or not a draft; scope shrinkage below the acceptance criterion without an evidenced blocker.
    - **should-change**: missing `website/docs/` page for user-visible behaviour; ruff/ASYNC or footgun findings; cross-platform gaps; missing negative/edge tests; declared-vs-registered manifest drift (doctor warnings); commit hygiene.
    - **nit**: style, naming, comment hygiene (a comment restating the line or narrating change history is a nit-to-should; a concise non-obvious *why* is correct — don't flag it).

    Verdict: `APPROVE` iff zero must-change; else `REQUEST_CHANGES`. Then run `/codex-critique` with `STAGE: CODE_REVIEW` — ARTIFACTS: `git diff origin/<BASE>...HEAD` in `/workspace/agent/wt-review-<N>`, the acceptance-test path, your re-run results, and your findings draft. Codex is independent: where it disagrees, record both positions under `Disagreements`; your verdict stands but must say why.
  deliver: |
    **Deliver** — Write the review to `/workspace/agent/reviews/<N>.md` (heredoc; new file), then critique it before it leaves the session.

    Sections, in order: `# Review — <fork-slug>#<N> (round <k>)` with PR URL, **head SHA reviewed**, requirement id, ADR path; `## Verdict` (`APPROVE` | `REQUEST_CHANGES`); `## Re-run evidence` — the exact commands with exit codes, pass/fail counts, doctor output tail, negative-control result, ruff/footguns results; `## Scope check` — table `file → allowed | CORE-CHANGE cited <file:line> | VIOLATION`; `## Findings` — must-change / should-change / nit, each `<file>:<line> — what is wrong, why (rule citation), the fix`; `## Test gaps`; `## Disagreements` (codex vs you, `none` if none); `## References` (release-tree `file:line`). Round 2+ appends a `## Round <k>` block to the same file with the new head SHA.

    Then `/codex-critique` with `STAGE: OUTPUT_REVIEW` — ARTIFACTS: `/workspace/agent/reviews/<N>.md` (attested) plus the verdict text you are about to send. Must-fix → revise the review, re-run OUTPUT_REVIEW; any later edit to the file invalidates the attested hash — re-run before Handoff. Optional cleanup of YOUR worktrees only: `git -C /workspace/agent/hermes-agent worktree remove /workspace/agent/wt-review-<N>-base`.
  handoff: |
    **Handoff** — Return the verdict on the builder's edge, as a reply. Both gates require it: the chain-routing gate refuses a marker-prefixed send without `in_reply_to`, and the critique gate releases `[Review Verdict]` only with CODE_REVIEW + OUTPUT_REVIEW recorded and fresh.

    ```
    send_message(in_reply_to=<review-request-id>, text="[Review Verdict] <fork-slug>#<N> (round <k>, head <sha7>)\n\n- **Verdict:** APPROVE | REQUEST_CHANGES\n- **Re-run:** doctor <OK|FAIL>; acceptance <PASS|FAIL>; tests/plugins+hermes_cli <PASS|X failures>; negative control <FAILS-on-base as expected|PASSES-on-base>\n- **Scope:** all in plugins/**,website/docs/**,tests/** | CORE-CHANGE cited {{vars.release_tree}}/<file>:<line> | VIOLATION: <files>\n- **Top concern:** <highest-severity finding, or 'none'>\n- **Next-action:** merge the draft in the fork | address <n> must-change items (see attached review)")
    send_file(in_reply_to=<review-request-id>, path="/workspace/agent/reviews/<N>.md")
    ```

    No `to=` — `in_reply_to` resolves the builder's edge exactly (do not `to="parent"` unless the builder is your parent; do not message `hermes-architect` even though the lineage rule may allow it — ADR concerns go to the builder, who relays). Never push, never edit the PR, never comment on GitHub, never mark the PR ready. Then stop; a round-2 request re-enters at Research with a fresh `git fetch` of the new head. Do not answer status echoes.
---

# hermes-review

## Hermes deltas

- Mode is always `review`. The deliverable is `/workspace/agent/reviews/<N>.md`, not the base `reports/` path.
- Adversarial by construction: the verdict binds to a head SHA you checked out in your OWN worktree (`/workspace/agent/wt-review-<N>`), with doctor `--ci`, the acceptance test, `tests/plugins/` + `tests/hermes_cli/`, ruff, footguns, and a negative control on the base tree all re-run by you.
- Plugin-first boundary is a hard gate: any diff outside `plugins/**`, `website/docs/**`, `tests/**` without a valid ADR `## CORE-CHANGE` citation of `{{vars.release_tree}}/<file>:<line>` is a must-change → `REQUEST_CHANGES`.
- Read-only role: no `git push`, no PR edits, no GitHub comments. `[Review Verdict]` is always a reply (`in_reply_to=<review-request-id>`) on the builder's edge.

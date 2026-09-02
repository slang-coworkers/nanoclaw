---
name: hermes-implement
type: workflow
description: 'Implement a Hermes Agent capability as a plugin in the fork worktree from an architect ADR + acceptance test: prove the test fails, build the plugin, pass doctor --ci and scripts/run_tests.sh, open a draft PR to the FORK only, then request peer review from hermes-reviewer.'
extends: implement
requires: [code.read, code.edit, test.run, test.gen, repo.pr]
uses:
  skills: [hermes-build, hermes-code-reader, hermes-github, hermes-code-writer]
  workflows: []
overrides:
  setup: |
    **Setup** — The plan is the architect's ADR; it must be on disk under `/workspace/agent/reports/` before any source edit (that write is what the plan-gate keys on).

    1. **Locate the spec.** The handoff arrived as a message plus two attachments under `/workspace/inbox/<msg-id>/`: `<slug>.md` (ADR) and `<slug>-acceptance_test.py`. Record `<spec-inbound-id>` — every upstream report on this task replies to it. Copy them into place (the ADR is new here, so plain `cp`, not `Write`):
       ```bash
       mkdir -p /workspace/agent/reports /workspace/agent/fixes /workspace/agent/build
       cp /workspace/inbox/<msg-id>/<slug>.md                    /workspace/agent/reports/{{target_slug}}.md
       cp /workspace/inbox/<msg-id>/<slug>-acceptance_test.py    /workspace/agent/reports/{{target_slug}}-acceptance_test.py
       ```
       No ADR arrived and the task is non-trivial → run the **hermes-plan** workflow (mode = plan) yourself first; never improvise a plugin design from the chat text. Extract from the ADR: requirement id, plugin name/key, `## Plugin surface`, `## CORE-CHANGE` (`none` or a cited `{{vars.release_tree}}/<file>:<line>`), and `## Acceptance test` target path.
    2. **Fork checkout + one worktree per target — never the main checkout, never upstream:**
       ```bash
       FORK=<fork remote URL from /hermes-github — the FORK, never https://github.com/{{vars.repo}}>
       [ -d /workspace/agent/hermes-agent/.git ] || git clone "$FORK" /workspace/agent/hermes-agent
       cd /workspace/agent/hermes-agent
       git remote get-url upstream >/dev/null 2>&1 || git remote add upstream https://github.com/{{vars.repo}}.git
       git fetch origin && git fetch upstream --tags            # brings {{vars.release_tag}}
       DEFAULT=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#origin/##'); DEFAULT=${DEFAULT:-main}
       git worktree add /workspace/agent/wt-{{target_slug}} -b plugin/{{target_slug}} "origin/$DEFAULT"
       cd /workspace/agent/wt-{{target_slug}}
       git merge-base --is-ancestor {{vars.release_tag}} HEAD || echo "NOTE: fork default branch has drifted from {{vars.release_tag}} — record in the implementation log"
       ```
       All editing/building/committing happens in `/workspace/agent/wt-{{target_slug}}`. **[MUST NOT] Worktree isolation.** You can SEE sibling `wt-<other-target>/` dirs but never read, write, mv, rm, or `git worktree remove` them. `/workspace/agent/` full → report `blocked` to parent with `df -h /workspace/agent`; don't delete sibling worktrees.
    3. **Environment — once per worktree, always in an `Agent` subagent (never inline, never `run_in_background`):**
       ```
       Agent(prompt="cd /workspace/agent/wt-{{target_slug}} && uv sync --locked --python /usr/bin/python3 --extra dev > /workspace/agent/build/uv-sync-{{target_slug}}.log 2>&1; echo exit=$?; tail -30 /workspace/agent/build/uv-sync-{{target_slug}}.log. Never run `uv python install` (no interpreter downloads). Run uv sync OUTSIDE scripts/run_tests.sh — that script execs under `env -i` and strips the proxy/CA env uv needs. Report: exit code, errors, log path.")
       ```
       Then for every `hermes` CLI smoke run in this worktree: `export HERMES_HOME=/workspace/agent/.hermes-testbed && mkdir -p "$HERMES_HOME"` and call `.venv/bin/hermes` (pytest does not need `HERMES_HOME` — `tests/conftest.py` sandboxes it per test). Missing apt packages (ripgrep, ffmpeg, make, python3-dev, libffi-dev, procps, xz-utils) → request them in one `install_packages` call before the build, if the runtime allows it; otherwise log the gap.
    4. **Before any edit:** run `/codex-critique` with `STAGE: PLAN_REVIEW` on `/workspace/agent/reports/{{target_slug}}.md` plus your file plan (exact paths you will create under `plugins/<name>/`, `tests/`, `website/docs/`). The architect already reviewed the ADR in its own session; your gate needs its own round.
    5. Start the implementation log at `/workspace/agent/fixes/{{target_slug}}.md` (heredoc): spec inbound id, worktree, branch, plugin key, CORE-CHANGE flag, decisions. Never ask permission between steps; log judgment calls. Loop back to the plan at most **2 times**; third failure → escalate. On restart: read the log + `git log --oneline -10`, `cd` into your worktree, resume.
  reproduce: |
    **Reproduce** — The acceptance test is the failing test; prove it fails before writing the plugin.

    ```bash
    cd /workspace/agent/wt-{{target_slug}}
    cp /workspace/agent/reports/{{target_slug}}-acceptance_test.py tests/plugins/test_<plugin>_acceptance.py   # target path from the ADR; must match test_*.py
    scripts/run_tests.sh tests/plugins/test_<plugin>_acceptance.py       # EXPECT: FAIL (plugin dir absent / key not loaded)
    ```
    Always `scripts/run_tests.sh`, never bare `pytest` (per-file subprocess isolation, `TZ=UTC`, `HERMES_DISABLE_LAZY_INSTALLS=1`, hermetic `HERMES_HOME`). A test that PASSES here does not test the plugin: do not weaken assertions to force a failure and do not proceed — fix the test to the ADR's acceptance criterion, note the discrepancy in the implementation log, and if the criterion itself is wrong reply to the architect (`send_message(in_reply_to=<spec-inbound-id>, ...)`) and end the turn. Features have no bug to reproduce: the failing acceptance test IS the skeleton showing the gap.

    Commit the failing test separately so the PR shows the delta:
    ```bash
    git add tests/plugins/test_<plugin>_acceptance.py
    git commit -m "test(plugins): failing acceptance test for <req-id>"
    ```
  change: |
    **Change** — Minimum edit matching the ADR, as a Hermes plugin, in one subsystem, existing style. Use `/hermes-code-writer`.

    **Allowed paths:** `plugins/<name>/**` (or `plugins/<category>/<name>/**` — the plugin key then becomes `<category>/<name>`), `website/docs/**`, `tests/**`. **Anything else is a core change**: allowed ONLY if the ADR's `## CORE-CHANGE` section cites the exact `{{vars.release_tree}}/<file>:<line>` that blocks a plugin, and then only as the minimal GENERIC widening it describes (new hook / `ctx` method / config key) — never a special case for this plugin in `run_agent.py`, `cli.py`, `gateway/run.py`, `hermes_cli/main.py`, `toolsets.py`, or `pyproject.toml`. If the ADR says `none` and you discover a core edit is needed: STOP, write the blocking `file:line` to the implementation log, reply to the architect on the spec edge (`send_message(in_reply_to=<spec-inbound-id>, text="Blocked on CORE-CHANGE: <file:line> — <why a plugin cannot>")`), and end the turn. A new PyPI dependency is a core change too (`pyproject.toml` + `uv lock`); prefer stdlib or deps already pinned in the release.

    **Plugin shape (directory plugin):** `plugins/<name>/plugin.yaml` with `manifest_version: 1`, `name`, `version`, `description`, `provides_tools: [...]`, `provides_hooks: [...]` (declared must equal registered — doctor warns on drift), optional `kind: platform` for gateway adapters, `requires_env` only for real secrets; `plugins/<name>/__init__.py` with `def register(ctx):` calling `ctx.register_hook(<hook in VALID_HOOKS>, cb)` / `ctx.register_tool(name=, toolset=, schema=, handler=, check_fn=)` / the other `register_*` methods named in the ADR. Contracts: every hook callback accepts `**kwargs`; tool handlers are `def handler(args: dict, **kwargs) -> str` returning a JSON string and never raising; durable state via `plugins.plugin_storage.plugin_data_dir(<name>)` / `plugin_db(<name>)` — never inside the plugin dir; settings via `ctx.get_config` under `plugins.entries.<id>.settings` — never a new `HERMES_*` env var for non-secret config; paths via `get_hermes_home()` / `display_hermes_home()` — never `~/.hermes` or `Path.home()/'.hermes'`; cross-platform (`shutil.which`, `psutil`, `pathlib`, no bare `os.kill(pid, 0)`); `shlex.quote` shell input; catch specific exceptions and `logger.warning(..., exc_info=True)`; no blocking HTTP/subprocess/sleep inside `async def` (ruff ASYNC210/220/221/251 apply to `plugins/**`). Portable Agent Plugins v1 (`plugin.json` + `skills/<name>/SKILL.md` [+ `mcp.json`]) only when the ADR chose that shape. To replace a bundled plugin the manifest `name`/key must match the bundled one exactly — verify with `HERMES_PLUGINS_DEBUG=1 .venv/bin/hermes plugins list`.

    **Tests:** extend `tests/plugins/test_<plugin>_acceptance.py` and add unit tests beside it — behavior contracts only (no snapshots, model lists, version literals, enumeration counts; never read source in a test; nothing under `~/.hermes`; OS-specific tests use `@pytest.mark.linux_only/macos_only/windows_only`, never bare `skipif`). **Docs:** a page under `website/docs/` for user-visible behaviour; edit existing pages before creating new ones. **Commits:** Conventional Commits `<type>(<scope>): <description>` (`feat(plugins): ...`, `docs(plugins): ...`), one logical change.

    **Validate the plugin as you go:**
    ```bash
    cd /workspace/agent/wt-{{target_slug}} && export HERMES_HOME=/workspace/agent/.hermes-testbed
    .venv/bin/hermes plugins doctor plugins/<name> --ci      # must exit 0 and print "OK: runtime discovery, manifest parsing, import, and registration passed"
    ```
    Fix errors AND warnings (unknown hook, callback without `**kwargs`, declared-vs-registered drift) before Verify. Log unrelated observations in the implementation log; don't act on them.
  verify: |
    **Verify** — Prove it from the worktree, in this order; the suite runs in `Agent` subagents with an explicit Bash `timeout` (the declared timeout raises the host's kill ceiling; a silent inline run does not heartbeat). Never `run_in_background`.

    ```bash
    cd /workspace/agent/wt-{{target_slug}} && export HERMES_HOME=/workspace/agent/.hermes-testbed
    .venv/bin/hermes plugins doctor plugins/<name> --ci                          # 1. exit 0
    scripts/run_tests.sh tests/plugins/test_<plugin>_acceptance.py               # 2. PASS (it FAILED in Reproduce)
    uv run ruff check plugins/<name> tests/plugins/test_<plugin>_acceptance.py    # 3. clean (ruff is in the dev extra; blocking in CI)
    python3 scripts/check-windows-footguns.py                                    # 4. clean
    ```
    5. Focused suites, one `Agent` subagent, explicit timeout: `scripts/run_tests.sh tests/plugins/ tests/hermes_cli/` — log to `/workspace/agent/build/tests-{{target_slug}}-focused.log`; the subagent reports pass/fail counts, FLAKY lines, and the last 40 lines on failure.
    6. Full suite, chunked: notify parent first (`send_message(to="parent", in_reply_to=<spec-inbound-id>, text="⚙️ verify — plugin/{{target_slug}} — full suite chunked by dir, ETA ~<n> min")`), then one `Agent` subagent per chunk (`scripts/run_tests.sh tests/agent`, `tests/gateway`, `tests/tools`, `tests/skills`, `tests/hermes_cli`, `tests/plugins`, then the remaining top-level dirs), each with its own explicit Bash `timeout` and log under `/workspace/agent/build/`. A `FLAKY` (pass-on-retry) line is a bug to fix, not noise. Optional CLI smoke when the ADR names one: `.venv/bin/hermes plugins enable <key>` then the ADR's `hermes ...` command against the testbed `HERMES_HOME`.
    7. `/codex-critique` with `STAGE: CODE_REVIEW` — ARTIFACTS: `git diff origin/<default>..HEAD` plus the acceptance-test path and results. Must-fix → fix, re-run 1–6, re-run CODE_REVIEW.

    Updating a PR after `[Review Verdict] REQUEST_CHANGES`: address every must-change first, then re-run 1–7. Fails after **2 independent fix attempts** → commit the failing state with a `wip:` prefix, write the failure summary (what was tried, last 50 log lines) to `/workspace/agent/fixes/{{target_slug}}.md`, escalate on the spec edge (`in_reply_to=<spec-inbound-id>`) — don't loop.
  ship: |
    **Ship** — Draft PR to the FORK only, then peer review before any report.

    1. **Push + draft PR (fork only, never {{vars.repo}}):**
       ```bash
       cd /workspace/agent/wt-{{target_slug}}
       git push -u origin plugin/{{target_slug}}                                  # origin = the fork; never `upstream`
       FORK_SLUG=$(gh repo view --json nameWithOwner -q .nameWithOwner)           # must NOT print {{vars.repo}}
       gh pr create --draft --repo "$FORK_SLUG" --base "$DEFAULT" --head plugin/{{target_slug}} \
         --title "<type>(<scope>): <description> [<req-id>]" --body-file /workspace/agent/fixes/{{target_slug}}-pr.md
       ```
       PR body (write it first, then `/codex-critique` `STAGE: OUTPUT_REVIEW` on it — the critique gate needs OUTPUT_REVIEW recorded before `gh pr create`): **What / Why** (requirement id + acceptance criterion), **Plugin surface**, **CORE-CHANGE** (`none` or the ADR citation), **How to test** (the exact doctor + `scripts/run_tests.sh` commands and results), **Platforms tested**, **ADR** (path + key sections inline), the 5-bullet status. Never `--web`, never mark ready-for-review, never open against `{{vars.repo}}`. Then `mcp__nanoclaw__report_pr_created({repo: "<fork-slug>", pr_number: <N>})` so review webhooks route back to this session.
    2. **Peer review request to `hermes-reviewer` — required, before any `[Fix Report]`.** The always-on chain-routing gate refuses a marker-prefixed `send_message` that lacks `in_reply_to`, so the shape depends on the round:
       - **Round 1 (fresh — the reviewer has not written to you on this thread):** UNMARKED first line, explicit `thread_id` = the thread you received the spec on (`hermes-<req-id>`), propagated unchanged:
         ```
         send_message(to="hermes-reviewer", thread_id="hermes-<req-id>", text="Fix review request — <fork-slug>#<N>: <title>\n- **PR:** <url> (draft, fork only; head <sha>)\n- **Requirement:** <req-id>; ADR attached\n- **Acceptance test:** tests/plugins/test_<plugin>_acceptance.py — FAIL before, PASS after\n- **Doctor:** hermes plugins doctor plugins/<name> --ci — OK\n- **Suite:** tests/plugins + tests/hermes_cli PASS; full suite <result>\n- **CORE-CHANGE:** none | {{vars.release_tree}}/<file>:<line>")
         send_file(to="hermes-reviewer", thread_id="hermes-<req-id>", path="/workspace/agent/reports/{{target_slug}}.md")
         ```
       - **Round 2+ (answering the reviewer's `[Review Verdict] REQUEST_CHANGES`):** marked and linked — `send_message(in_reply_to=<verdict-msg-id>, text="[Fix Review Request] <fork-slug>#<N> (round <k>): <what changed>\n...same bullets...")`.
       End the turn after sending; the reviewer re-runs everything in its own container (20–60 min). No status echoes. **Max 2 review rounds** — then keep the better diff and report with the unresolved feedback listed. Only legitimate skip: `hermes-reviewer` not in your destinations — say so in the report.
    3. **`[Fix Report]` — only after `[Review Verdict] APPROVE` lands from `hermes-reviewer`.** Reply on the spec edge:
       ```
       send_message(to="parent", in_reply_to=<spec-inbound-id>, text="[Fix Report] <req-id>: <title>\n- **Status:** implemented as plugin <key>; draft PR open in the fork\n- **Link:** <PR url> (head <sha>)\n- **Verdict:** reviewer APPROVE (round <k>); acceptance PASS; doctor OK; suite <result>\n- **Next-action:** human merges the draft in the fork\n- **Blocker:** none | <unresolved reviewer item>")
       ```
       Also refresh the PR description with the final state and append the outcome to `/workspace/agent/fixes/{{target_slug}}.md`. Never send `[Fix Report]` before APPROVE; never send it to the reviewer; don't wait for human confirmation to open the draft.
---

# hermes-implement

## Hermes deltas

- Every capability is a Hermes plugin (`plugin.yaml` `manifest_version: 1` + `__init__.py register(ctx)`, or an Agent Plugins v1 package). Edits outside `plugins/**`, `website/docs/**`, `tests/**` are allowed only under the ADR's `## CORE-CHANGE` citation of `{{vars.release_tree}}/<file>:<line>`; otherwise stop and reply to the architect.
- Fork checkout at `/workspace/agent/hermes-agent`; one worktree per target at `/workspace/agent/wt-<target_slug>`; `uv sync --locked --python /usr/bin/python3 --extra dev` in an `Agent` subagent, outside `scripts/run_tests.sh`; never `uv python install`.
- Tests only via `scripts/run_tests.sh`; plugins validated with `.venv/bin/hermes plugins doctor <dir> --ci`; `HERMES_HOME=/workspace/agent/.hermes-testbed` for CLI smoke runs; long runs chunked in `Agent` subagents with explicit Bash `timeout`, never `run_in_background`.
- Draft PR to the fork only; `[Fix Review Request]` marker only on a reply (`in_reply_to`), the round-1 request is an unmarked message with `thread_id="hermes-<req-id>"`; `[Fix Report]` to parent only after `[Review Verdict] APPROVE`.

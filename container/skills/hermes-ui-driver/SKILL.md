---
name: hermes-ui-driver
license: MIT
description: "Drive the Hermes UIs from a coworker container so an acceptance criterion can be executed as a user would see it: the `hermes dashboard` web SPA under agent-browser (launch, readiness, chat send + reply, profile rail, new-bot flow, a2a proof out of state.db) and the apps/desktop Electron app under xvfb-run + Playwright (the full build chain, the run flags that actually produce a JSON report, the pinned tag's known-failing specs, the failure-classification rubric). Load when writing or executing a `ui:`, `desktop:` or `live:` criterion (`tests/e2e-scenarios/<req-id>/AC-<req-id>-<n>.md`, `apps/desktop/e2e/<req-id-lowercase>-ac<n>.spec.ts`), and read the gotchas table before blaming a red run on the PR."
provides: [ui.drive]
allowed-tools: Bash(agent-browser:*), Bash(xvfb-run:*), Bash(npx:*), Bash(npm:*), Bash(hermes:*), Bash(python3:*), Bash(bash:*), Read, Grep, Glob
---

# Hermes UI Driver (hermes-tester, hermes-builder)

Two roles load this skill. **hermes-builder** writes scenario files, fixtures and desktop specs that are actually drivable, and commits them in the same draft PR. **hermes-tester** executes them in the Scenario tier of `hermes-verify`, one screenshot per step, `PASS | FAIL` per criterion id.

`/hermes-testbed` still owns the mechanisms around this one: the hermetic harness and its env file (§2), the loopback model stub and the live tier (§3a), UI parity T10–T12 (§4), the desktop phase gate and the `DESKTOP=SKIPPED` rule (§5), the artifact tree and the report (§6). This skill owns only the driving. Variables are the testbed's: `$TB`, `$WT`, `$ART`, `$HERMES_HOME`, `$THREAD`.

Two rules that never bend, from `no-push.md` and `peer-review.md`:

- The tester **never edits a scenario file or a spec.** A scenario file missing at the PR head, or a `desktop:` spec that does not exist, is a `FAIL` for that criterion id with the reason in the evidence cell, exactly like a missing pytest function. The builder fixes it in the PR.
- Nothing here pushes, comments on GitHub, or opens a PR. A spec the tester writes itself travels as `$ART/tests.patch` plus `send_file`.

## 0. What a scenario file hands you

`tests/e2e-scenarios/<req-id>/AC-<req-id>-<n>.md` is the executable contract. Read the frontmatter first, then Setup, then Steps.

| field | what the driver does with it |
|---|---|
| `ac: AC-<req-id>-<n>` | the row id in `## Results`, and the artifact dir `$ART/scenario-<AC-id>/` |
| `kind: ui` | drive the web dashboard, §1 |
| `kind: live` | drive the same surface with a real model behind it, §1 plus the budget bound in §1f |
| `model: stub` | point the harness at the loopback stub first (`/hermes-testbed` §3a); the canned reply is your `wait --text` target |
| `model: live` | source `$TB/harness.live.env` instead of `$TB/harness.env` (`/hermes-testbed` §3a: dummy key, real base URL, credential injected by the OneCLI proxy, never a real key under `$TB`, `$WT` or `$ART`) |
| `fixtures: [fixtures/<bot>/]` | `hermes profile install $SCN/fixtures/<bot> --name <bot> -y` in Setup (`hermes_cli/subcommands/profile.py:153-180`; local dir with `distribution.yaml` at root, `:157-159`) |
| `timeout_s` | the ceiling for EACH step's bounded wait (`timeout <timeout_s> agent-browser wait …`), `/hermes-testbed` §4b; the whole scenario is capped separately by the tier cap in `/hermes-testbed` §7 (10 min per criterion). Defaults when the file omits it: `300` for `ui`, `600` for `live` |

`desktop:` criteria are not scenario files. They are Playwright specs at `apps/desktop/e2e/<req-id-lowercase>-ac<n>.spec.ts` and run through §2.

```bash
SCN=$WT/tests/e2e-scenarios/<req-id>; AC=AC-<req-id>-<n>
mkdir -p $ART/scenario-$AC
```

One screenshot per step at `$ART/scenario-$AC/step-<n>.png`, numbered as the file numbers its steps. The tester's `## Results` row for this id carries `kind` = `ui | desktop | live` and an `evidence` cell naming that path; a `ui`/`desktop`/`live` PASS with no evidence path is invalid and the reviewer rejects the report.

## 1. Web dashboard (`ui:` and `live:` scenarios)

### 1a. Launch and readiness

Flags are the ones `/hermes-testbed` §4 verified (`hermes_cli/subcommands/dashboard.py:26-31, 42-50, 51-60, 101-109`); do not invent one. `hermes serve` from T2 must be down first (`hermes dashboard --status`, `:75-84`).

```bash
( source $TB/harness.env && cd $WT
  export HERMES_WEB_DIST=/workspace/agent/build/web_dist-<sha7>          # prebuilt SPA; the build itself is network and runs in an Agent OUTSIDE the harness (/hermes-testbed §4)
  hermes dashboard --host 127.0.0.1 --port 9119 --no-open --isolated --skip-build > $ART/dashboard.log 2>&1 &
  echo $! > $TB/dashboard.pid
  timeout 300 bash -c "until grep -qE 'HERMES_DASHBOARD_READY port=|Hermes Web UI' $ART/dashboard.log; do sleep 2; done"   # web_server.py:19932, 19950; bounded
)
```

Two ready lines exist, and which one a given launch prints depends on the server mode (`web_server.py:19932`, `:19948`, `:19950`): `hermes dashboard` announces the SPA as `Hermes Web UI → http://<host>:<port>` and the machine-readable `HERMES_DASHBOARD_READY port=9119`; `hermes serve` prints `Hermes backend listening on <host>:<port>` / `HERMES_BACKEND_READY port=9119`. **Always grep the alternation, never a single token** — waiting on the one this launch did not print burns the whole timeout on a server that came up fine. `/hermes-testbed` §4 and `hermes-verify` steps 3a and 4b use exactly the `grep -qE 'HERMES_DASHBOARD_READY port=|Hermes Web UI'` form above. The log line is the readiness gate; `/api/health` (`web_server.py:3680`) is the testbed's liveness probe in §4, not a substitute for waiting.

**Never click through the gateway "checking" screen.** While the backend is still coming up the UI paints a connecting overlay (the desktop shell spells the same state `checking`, `apps/desktop/src/lib/runtime-readiness.ts`; the Playwright config emulates reduced motion precisely so those overlays are not caught mid-fade, `apps/desktop/playwright.config.ts`). Clicking into it produces screenshots of a loading state and refs that go stale a second later. Wait for the ready line, then open the page.

A fresh `HERMES_HOME` has no provider unless the stub configured one, so an onboarding overlay is an expected first screen. Record what rendered instead of dismissing it silently.

### 1b. The agent-browser recipe

Same shape as `/hermes-testbed` §4, one screenshot per scenario step instead of per T-row. Headless Chromium is the image default (`AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium`); `no_proxy` in `harness.env` keeps loopback off the dead proxy.

```bash
agent-browser open "http://127.0.0.1:9119/"
agent-browser wait --load networkidle
agent-browser snapshot -i                                  # refs @eN; re-snapshot after navigation or any DOM change
agent-browser screenshot $ART/scenario-$AC/step-1.png --full
# step n: click/fill by @ref → one bounded wait for the observable fact the step names → screenshot step-<n>.png
agent-browser close
```

The SPA is a `BrowserRouter`, so a step may navigate by URL instead of hunting for a nav item: `/chat`, `/sessions`, `/profiles`, `/profiles/new`, `/plugins`, `/config` are real routes (`web/src/App.tsx`). Re-snapshot after every such jump.

Bounded waits only (`/agent-browser`): `agent-browser wait --text`, `--url`, `--load` under an outer `timeout`. On TIMEOUT take exactly one `snapshot -i` and one screenshot, save both, `FAIL` that criterion id with the screenshot as evidence, and move on. Never re-enter the wait: an unbounded poll wedges the whole turn.

Refs come from the accessibility snapshot. `[data-slot="…"]` selectors belong to the Electron app and do not exist in the web SPA, so a CSS selector copied out of a desktop spec matches nothing here. Use `@ref` from `snapshot -i`, or the semantic form (`agent-browser find role button click --name "<visible label>"`).

### 1c. Send a chat message and read the reply

```bash
agent-browser open "http://127.0.0.1:9119/chat"
agent-browser wait --load networkidle
agent-browser snapshot -i                                  # find the composer textbox and the bot/session entry by their visible labels
agent-browser click @e<session>                            # open the bot's chat
agent-browser fill @e<composer> "<the prompt the scenario names>"
agent-browser press Enter
agent-browser screenshot $ART/scenario-$AC/step-2.png --full
timeout 120 agent-browser wait --text "<the stub's canned reply>"
agent-browser screenshot $ART/scenario-$AC/step-3.png --full
```

With `model: stub` the reply text is deterministic (the stub's one canned completion), so `wait --text` has an exact target. With `model: live` there is no fixed string: wait on a structural fact the scenario names (an assistant bubble present, the composer re-enabled) and confirm the content in `state.db` per §1f. Read what actually landed with `agent-browser get text @e<transcript>` after a fresh snapshot; `agent-browser eval` is the fallback, still bounded.

`[role="alert"]` visible in the snapshot after a send is a failure of the step, not noise.

### 1d. Switch profiles in the rail

The rail and the profile switcher are the SPA's own (`web/src/components/ProfileSwitcher.tsx`, `web/src/pages/ProfilesPage.tsx`, route `/profiles`); click by `@ref` from the snapshot, never by a selector guessed from the desktop app. After the switch, re-snapshot before anything else: the whole page rerenders and every earlier ref is dead.

The UI is not the proof. What proves the switch took is where the next action wrote: `$HERMES_HOME/profiles/<bot>/` for the profile the scenario named. A scenario whose Pass sentence is "the rail shows bot-b selected" gets the screenshot; one whose Pass sentence is "the message went to bot-b" gets the `state.db` query too.

Bots only appear as a bot-managed roster once the `ui_meta.hermes-bots` block is on `profile.yaml`. No CLI writes it (`/hermes-testbed` T3: the `profiles.configure` RPC does it in the desktop shell, `tui_gateway/methods_profiles.py:749, 780-782`; `profile.yaml` is not distribution-owned, `hermes_cli/profile_distribution.py:88-95`), so a fixture install alone leaves the probe empty (`tools/bot_mode_probe.py:288`). If the scenario's Setup does not do it, the rail being empty is a scenario defect to report, not a product failure.

### 1e. Create a bot through the UI

`/profiles/new` is the builder page (`web/src/App.tsx` maps it to `ProfileBuilderPage`). Drive it by `@ref` through the form the snapshot shows, screenshot each step, then verify outside the UI:

```bash
( source $TB/harness.env && hermes profile list )                                    # the new name is listed
( source $TB/harness.env && hermes -p <new-bot> -z 'say hi' )                        # exit 0 against the stub (_parser.py:154-155; -p pre-parsed, main.py:521-522)
```

A profile dir under `$HERMES_HOME/profiles/` plus a one-shot that exits 0 is the pass; a name in the rail alone is not.

### 1f. Prove an a2a delegation happened

Every `live:` criterion in the chain is one of these: bot A asks bot B, and the reply must be visible. Take both halves.

**UI half.** Screenshot A's chat showing the delegation and the returned answer, per §1c.

**State half.** The target profile's own `state.db` (per `/hermes-testbed` T5, which joins sessions and messages; schema in `hermes_state_common.py`):

```bash
python3 -c "import sqlite3, os; d = sqlite3.connect(os.environ['HERMES_HOME'] + '/profiles/<bot-b>/state.db'); [print(r) for r in d.execute(\"select s.id, s.source, m.role, datetime(m.timestamp,'unixepoch'), substr(m.content,1,120) from messages m join sessions s on s.id = m.session_id order by m.timestamp desc limit 10\")]"
```

**The image has no `sqlite3` CLI** (`container/Dockerfile` installs chromium, python3, jq, curl, socat and no sqlite3) and the tester installs nothing, so every state.db read is the stdlib form above — the same shape `/hermes-testbed` T5 uses. A scenario whose `## Evidence` names a bare `sqlite3 …` command is a scenario defect you report; you do not rewrite the file.

A reply row in B for the dispatched message is the fact; A's transcript alone can show a hopeful sentence with nothing behind it. Put the query and its output in the scenario's Evidence section.

**Standing up the peer.** A `live:` a2a criterion needs a real second endpoint, not the §2 fake `api_server` stub (a stub is not a model and cannot satisfy a `live:` criterion). Ports `9120`–`9129` are reserved for scenario peers; the dashboard keeps `9119` for the whole tier. The scenario's `## Setup` starts B inside the harness:

```bash
hermes -p <bot-b> serve --host 127.0.0.1 --port 9120 --isolated > $ART/scenario-$AC/peer.log 2>&1 &   # -p is pre-parsed, so it precedes the subcommand
timeout 300 bash -c "until grep -qE 'HERMES_BACKEND_READY port=9120|Hermes backend listening on 127.0.0.1:9120' $ART/scenario-$AC/peer.log; do sleep 3; done"
```

then A's peer config points at `http://127.0.0.1:9120`. Kill it with the dashboard at the end of the tier. A scenario that names no peer bring-up and no port is a defect you report, not one you improvise.

**Budget bound for `live:` rows.** At most `LIVE_MODEL_CALLS_MAX=40` model calls and `LIVE_BUDGET_USD=5` per scenario, then stop and record `FAIL(budget)` for that id. Both are readable per profile:

```bash
python3 -c "import sqlite3, os; d = sqlite3.connect(os.environ['HERMES_HOME'] + '/profiles/<bot>/state.db'); print(*d.execute('select coalesce(sum(api_call_count),0), round(coalesce(sum(case when actual_cost_usd > 0 then actual_cost_usd else estimated_cost_usd end),0),4) from session_model_usage').fetchone())"
```

This table, not the connect log, is the binding count (`/hermes-testbed` §4b): check it between steps, after the scenario, and again before any retry, summed across every bot the scenario installed. The round carries its own ceiling too — `LIVE_ROUND_CALLS_MAX=120` / `LIVE_ROUND_BUDGET_USD=15` across all `live:` criteria (`/hermes-testbed` §7). A live row you cannot run without a real API key in hand is a `FAIL` for that criterion id (an `AC-` row has no SKIPPED state, `/hermes-testbed` §4b), never a PASS and never a reason to ask for a key.

## 2. Electron desktop (`desktop:` scenarios)

The phase gate stays in `/hermes-testbed` §5: preflight, then smoke, then the set, and any missing apt dependency is `DESKTOP=SKIPPED` with the verbatim `install_packages` request, never a hand-rolled `apt-get`.

### 2a. Build

`npm run build` in `apps/desktop` is a **chain**, not a bundler call: `assert-root-install.mjs`, `write-build-stamp.mjs`, `vite build`, `bundle-electron-main.mjs`, `stage-native-deps.mjs`, with a `prebuild` that cleans first and a `postbuild` that asserts the output. Running `vite build` on its own therefore leaves `dist/` cleaned and without `electron-main.mjs`, and every spec then fails at launch (`dist/` is the fixture prerequisite, `apps/desktop/e2e/fixtures.ts:20`).

```
Agent(prompt="cd /workspace/agent/wt-verify-<N>/apps/desktop && npm run build > /workspace/agent/reports/<thread-id>/artifacts/desktop-build.log 2>&1; echo build_exit=$?; ls dist/electron-main.mjs dist/index.html. Report exit + any missing file + last 20 log lines on failure.")
```

`hermes desktop --source --build-only` is the CLI equivalent (`hermes_cli/subcommands/gui.py:15-34`); plain `hermes desktop` launches and blocks. Node deps belong to the repo root, not to `apps/desktop` (`apps/desktop/scripts/assert-root-install.mjs:8-12`), so the `npm ci` is the root one from `/hermes-testbed` §4. Reuse `apps/desktop/dist` while `git diff --quiet <dist-sha> HEAD -- apps/` holds.

The Electron binary is downloaded by electron's postinstall during that root `npm ci` and lives under either layout (`apps/desktop/e2e/electron-binary.ts:30-38`). Missing after a green `npm ci` is `SKIPPED — electron-binary-missing`, not a FAIL.

### 2b. Run

```bash
( source $TB/harness.env && cd $WT/apps/desktop
  export CI=1 OPENROUTER_API_KEY= OPENAI_API_KEY= NOUS_API_KEY=                      # e2e-desktop.yml:120-125; no real keys reach the app
  # outer bound = the scenario tier cap, 10 min per criterion (/hermes-testbed §7); --timeout=180000 bounds each test inside it
  timeout 600 xvfb-run -a --server-args="-screen 0 1280x1024x24" \
    npx playwright test e2e/<req-id-lowercase>-ac<n>.spec.ts \
    --workers=1 --retries=1 --timeout=180000 \
    > $ART/scenario-$AC/playwright-stdout.log 2>&1 ; echo e2e_exit=$?
  cp playwright-report/results.json $ART/scenario-$AC/results.json                  # written by the config's CI json reporter (CI=1 above)
  cp -r test-results $ART/scenario-$AC/test-results                                 # per-test screenshots + traces
)
```

Why each piece, all of it learned the hard way in the preflight rounds:

- `xvfb-run -a --server-args="-screen 0 1280x1024x24"` because there is no display in the container (CI does the same, `.github/workflows/e2e-desktop.yml:113`).
- `CI=1` because the JSON reporter is registered only on the `CI` branch of `apps/desktop/playwright.config.ts`, writing `playwright-report/results.json`. **`PLAYWRIGHT_JSON_OUTPUT_NAME` does not exist in Playwright 1.62.1** and setting it produces no file at all; round 5 confirmed the variable is absent from the shipped source. `CI` also turns on the config's single retry (its `retries: process.env.CI ? 1 : 0`), which is why `--retries=1` matches rather than fights it. Do not pass `--reporter=json`: the CLI flag REPLACES the config's reporter list, so the file the `cp` above copies is never written and the JSON lands in the stdout log instead.
- `--workers=1` because the numbers are only trustworthy from one serialized pass. Rounds 1 through 4 mixed a timed-out run with a second run appended to the same log and produced totals nobody could reproduce; round 5 ran once, `--workers=1`, and read every number out of the JSON: 74 tests, 59 passed, 4 failed, 11 skipped, 25.7 min. Take counts from `results.json` (`stats.expected` / `stats.unexpected` / `stats.skipped`), never by parsing the list reporter's log.
- `--timeout=180000` because the config's 90 s per-test cap (`playwright.config.ts:37`) is sized for CI hardware; in this container the slower specs cross it while doing nothing wrong.
- An outer `timeout` on the whole call, because a wedged Electron will otherwise hold the turn open.

The fixtures are self-contained: they sandbox `HERMES_HOME`, set `HERMES_DESKTOP_IGNORE_EXISTING=1` and `HERMES_DESKTOP_HERMES_ROOT=<repo root>` so the app spawns `hermes serve` from your worktree (`apps/desktop/e2e/fixtures.ts:239-243`), launch Electron with `--disable-gpu --no-sandbox` (`:316-320`), and bind their own mock inference server on `127.0.0.1` (`apps/desktop/e2e/mock-server.ts:655`). You do not start a gateway or a model stub for them, and you do not add `--no-sandbox` anywhere yourself. Electron and node sit outside the harness's Python socket guard (`/hermes-testbed` §2 table); say so in the report.

**Known baseline at the pinned tag.** Round 5 established four pre-existing failures on `v2026.8.31` with no plugin under test, each reproduced in isolation:

| spec | class | first error |
|---|---|---|
| `apps/desktop/e2e/correction-session-switch.spec.ts` (`keeps a live correction in place …`) | APP | `expect(received).toBe(expected)`, correction absent after warm resume |
| `apps/desktop/e2e/sidebar-states.spec.ts` (`background dot visible while subagent runs`) | TIMEOUT-ALONE | `page.waitForFunction: Timeout 90000ms exceeded` |
| `apps/desktop/e2e/sidebar-states.spec.ts` (`background dot transitions to finished …`) | TIMEOUT-ALONE | same wait |
| `apps/desktop/e2e/tile-unread-bug.spec.ts` (`session opened as a tab … gets unread dot`) | TIMEOUT-ALONE | same wait, via the local `startTurnAndSwitchAway` helper |

The last three all wait on the same `finalText` produced by the cross-delegation script in `apps/desktop/e2e/mock-server.ts`. Exactly these four red is the tag's baseline, not your PR: report `FAIL(pre-existing: <spec>)`, non-blocking, and confirm against the fork's own workflow (`gh run list --repo slang-coworkers/hermes-agent --workflow "E2E Desktop" --limit 3`) as `/hermes-testbed` §5 requires. Never build a `desktop:` criterion on top of one of them.

Classification rubric for anything else, in this order:

| evidence | class |
|---|---|
| fails deterministically alone with a product assertion | **APP** |
| passes when run alone, fails in the set | **ENV** |
| spec differs from upstream `main` at the failing region | **SPEC** |
| times out alone, no assertion ever reached | **TIMEOUT-ALONE** |

`TIMEOUT-ALONE` exists because it is neither: the test never got far enough to assert, so calling it APP overstates and calling it ENV is simply wrong (ENV requires passing alone). Isolate before you classify: `npx playwright test --retries=0 --timeout=60000 <spec>:<line>`.

### 2c. Writing a requirement spec

A `desktop:` criterion's spec is a new file at `apps/desktop/e2e/<req-id-lowercase>-ac<n>.spec.ts` built on the shared fixtures (`apps/desktop/e2e/fixtures.ts:1-20`: `mockBackend`, `noProvider`), with `expectVisualSnapshot` from `visual-snapshot.ts` for screenshots. Copy the shape of an existing upstream spec in `apps/desktop/e2e/` rather than writing one from scratch; helper unit tests are `*.unit.test.ts` and belong to the vitest project (`playwright.config.ts:31-35`). The criterion id goes in the `test(...)` title, `test('AC-<req-id>-<n>: …', …)`, so the Playwright node id names the criterion the way `/hermes-testbed` §3c requires of pytest.

Builder commits it in the PR. If the tester writes one, it travels as `$ART/tests.patch`.

### 2d. Exploratory clicking on Electron over CDP

**Validate in Batch 0 before relying on it.** Playwright with the repo's own fixtures is the supported path and the only one any criterion may depend on today.

The exploratory idea is to launch the built app with a Chromium remote-debugging port and attach a driver to it:

```bash
( cd $WT/apps/desktop
  xvfb-run -a --server-args="-screen 0 1280x1024x24" \
    npx electron . --disable-gpu --no-sandbox --remote-debugging-port=9222 > $ART/electron-cdp.log 2>&1 &
)
timeout 60 bash -c 'until curl -fsS "http://127.0.0.1:9222/json/version" >/dev/null 2>&1; do sleep 2; done'
agent-browser connect 9222                                      # agent-browser 0.27.1 (the image's pin): `connect <port|url>` attaches over CDP
agent-browser snapshot -i                                       # the Electron window's tree, if the attach worked
agent-browser screenshot $ART/electron-cdp-attach.png
```

What Batch 0 has to answer before any scenario uses it: whether the endpoint comes up under xvfb at all, and whether `agent-browser connect` drives the Electron window the way it drives Chromium (the subcommand is documented in `agent-browser --help`; it has not been tried against Electron here). A bare `electron .` is also not the fixtures' environment: nothing sets `HERMES_DESKTOP_IGNORE_EXISTING`, `HERMES_DESKTOP_HERMES_ROOT` or a mock inference server, so the app will look for a real gateway. Until both answers are yes and written down, a `desktop:` criterion is a Playwright spec.

## 3. Gotchas

| symptom | what it means | what to do |
|---|---|---|
| Readiness grep never matches under `hermes dashboard` | a single token was used and this launch printed the other one (`web_server.py:19932, 19948, 19950`) | grep the `HERMES_DASHBOARD_READY port=|Hermes Web UI` alternation as in §1a |
| `EADDRINUSE` on 9119 | a leftover server in THIS container (each thread has its own netns, so it is never another thread) | `hermes dashboard --stop`, retry once, then FAIL with the log |
| First screen is an onboarding or provider overlay | fresh `HERMES_HOME` with no provider configured | configure the §3a stub before the scenario; record what rendered |
| Gateway shows "checking" and clicks do nothing | backend not ready yet | wait for the ready line; never click through the overlay |
| `[data-slot="…"]` matches nothing in the dashboard | those selectors are the Electron app's; the web SPA has none | drive by `@ref` from `snapshot -i` or `agent-browser find role/text` |
| `element not found` on a `@ref` that worked a moment ago | navigation or a rerender invalidated the refs | re-snapshot, then act; do not retry the same ref |
| A wait times out | the observable fact never appeared | one `snapshot -i` + one screenshot, FAIL that id, move on; never re-enter the wait |
| `dist/electron-main.mjs` missing after a "successful" build | `vite build` was run alone; `prebuild` cleaned and the bundle steps never ran | run `npm run build` in `apps/desktop` (§2a) |
| `npm ci` inside `apps/desktop` refuses | deps belong to the repo root (`assert-root-install.mjs:8-12`) | `npm ci` at the root worktree, once per round |
| `libasound2t64` will not install | that is the t64 rename newer Ubuntu carries; the coworker image is Debian bookworm, where the package is `libasound2` and is already present | never `apt-get`; request only the genuinely missing names via `install_packages` (`/hermes-testbed` §5) |
| Electron exits immediately, no window | no display | run under `xvfb-run -a --server-args="-screen 0 1280x1024x24"` |
| No `results.json` after the run | `PLAYWRIGHT_JSON_OUTPUT_NAME` does not exist in Playwright 1.62.1 | export `CI=1`; the config's CI branch writes `playwright-report/results.json` |
| Totals differ between two reads of the same log | two passes were appended to one log (a timed-out run plus a re-run) | one serialized pass, `--workers=1`, numbers from `results.json` only |
| `Test timeout of 90000ms exceeded` with no assertion | the 90 s config cap (`playwright.config.ts:37`) is CI-sized; this container is slower | `--timeout=180000`; if it still times out alone it is TIMEOUT-ALONE, not ENV |
| WebSocket close `1012` in the log after a failure | teardown, not the cause | read the first error in `results.json`, not the last line of the log |
| `Error: Channel closed` / `page.reload: Application exited` | the Electron process died mid-navigation | APP-class evidence, not a timeout; capture both attempts |
| `Target page, context or browser has been closed` right after a test timeout | teardown side effect of the timeout that already fired | do not count it as an independent failure |
| `launch-packaged-app` specs skip | no packaged binary; `dist/` is a dev build | expected, not a failure |
| Exactly the four §2b specs are red | the pinned tag's baseline | `FAIL(pre-existing: <spec>)`, non-blocking; confirm against the fork's `E2E Desktop` workflow |
| A `live:` scenario gets no reply in time | model, wiring or budget | check `session_model_usage` (§1f) and B's `state.db` before blaming the model; over the bound is `FAIL(budget)` |
| The scenario file or spec the ADR names is not at the head | the criterion was not shipped | `FAIL` for that id, evidence `no scenario file at head`; do not write it yourself |

## From project

- `hermes_cli/subcommands/dashboard.py:26-31, 42-50, 51-60, 75-84, 101-109`; `hermes_cli/web_server.py:3680, 19932, 19948, 19950`; `hermes_cli/main.py:521-522`; `hermes_cli/_parser.py:154-155`
- `hermes_cli/subcommands/profile.py:153-180`; `hermes_cli/profile_distribution.py:88-95`; `tui_gateway/methods_profiles.py:749, 780-782`; `tools/bot_mode_probe.py:288`; `hermes_state_common.py` (`sessions`, `messages`, `session_model_usage`)
- `web/src/App.tsx` (routes, `/profiles/new`), `web/src/components/ProfileSwitcher.tsx`, `web/src/pages/ProfilesPage.tsx`
- `apps/desktop/playwright.config.ts:31-35, 37` and its `CI` json-reporter branch; `apps/desktop/e2e/fixtures.ts:1-20, 20, 239-243, 316-320`; `apps/desktop/e2e/electron-binary.ts:30-38`; `apps/desktop/e2e/mock-server.ts:655`; `apps/desktop/scripts/assert-root-install.mjs:8-12`; `apps/desktop/e2e/correction-session-switch.spec.ts`, `sidebar-states.spec.ts`, `tile-unread-bug.spec.ts`; `.github/workflows/e2e-desktop.yml:113, 120-125`; `hermes_cli/subcommands/gui.py:15-34`
- Desktop preflight rounds 1–5 (`reports/desktop-preflight/`): round 5 is the trustworthy one, single serialized pass, 59 pass / 4 fail / 11 skip, rubric APP / ENV / SPEC / TIMEOUT-ALONE
- Skills `/hermes-testbed` (§2 harness, §3a stub + live tier, §4 UI parity, §5 desktop gate, §6 report), `/agent-browser` (bounded waits), `/hermes-build` (venv, run_tests.sh); invariants `no-push.md`, `peer-review.md`; workflows `hermes-verify` (Scenario tier), `hermes-implement` (scenario files ship in the PR)

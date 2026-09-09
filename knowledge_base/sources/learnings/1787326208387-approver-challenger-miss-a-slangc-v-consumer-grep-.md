---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787324844816-0v3qbw
written_at: 2026-08-21T15:30:08.387Z
---

# [approver/challenger-miss] a slangc -v consumer grep must enumerate extras/*.sh + tools/**, not just workflows

**Symptom.** On slang PR #12647 ("Fix #12645: report build-config divergence in `slangc -v`", @8eb6f652ce14), I drafted WOULD_APPROVE after a challenger probe that concluded "no other code/workflow fragile-parses `slangc -v` output." The DECISION_REVIEW critique (codex) named a consumer I had missed; I source-verified it and reversed to ABSTAIN_POLICY/OPEN_GAP.

**Root cause.** The PR appends a second line to `slangc -v` output (`build-config: release-lto=… standard-module-develop-build=…`). An UNTOUCHED sibling dev-tool, `extras/repro-remix.sh`, captures the FULL output and sanity-checks it:
```
SLANG_VERSION=$("$SLANGC" -version 2>&1)          # :207 — whole multiline output
if [[ "$SLANG_VERSION" =~ ^[0-9]{10,}$ ]]; then   # :211 — bash =~ anchors ^…$ to WHOLE string
  log_error "version appears invalid (timestamp only)"; exit 1   # catches a git-tag-less build
fi
```
Pre-PR, a tag-less build emits a timestamp-only line = all digits → the guard fires and aborts. Post-PR, the appended `build-config:` line makes the whole string non-all-digits → the regex NEVER matches → the guard silently never fires → a mis-built (tag-less) compiler passes the sanity check. A real, reachable regression of an existing safety guard, in a file the PR doesn't touch.

Why my probe missed it: I enumerated `.github/workflows/**` and GitHub code-search for `-v`/`-version`, and cleared the two hits I found (`nightly-remix-test.yml` compares NEW≠OLD — safe; `fetch_releases.py:233` uses `.splitlines()[0]` — safe). I never enumerated `extras/*.sh` or `tools/**` shell scripts, where the fragile whole-string consumer lived.

**How to catch it.** When a PR changes the TEXT of a CLI diagnostic that other tooling parses (`-v`, `-version`, `-help`, banner lines), the consumer sweep must cover, at minimum: `.github/workflows/**`, `extras/**` (esp. `*.sh`), `tools/**`, and `docs/**` generated-reference checks — not just workflows + code-search. And for each consumer, read the ACTUAL match logic: a whole-string-anchored regex (`[[ =~ ^…$ ]]`, `grep -x`, `re.fullmatch`) is defeated by an APPENDED line even though the semantically-relevant first line is unchanged; only `.splitlines()[0]` / `head -1` / first-line-anchored patterns are safe.

**Fix (procedure).** For a `-v`/`-version`/banner-text change: (1) grep the whole tree for `-version`/`-v`/`getBuildTagString` consumers across shell + python + workflows; (2) classify each by whether it reads the WHOLE output or just the first line; (3) any whole-string matcher on the changed output is a plausible-real-trigger gap ⇒ OPEN_GAP unless the change provably can't affect its predicate. The PR's own output being correct does NOT make it clean — the blast radius includes untouched sibling tools that parse that output.

**Meta.** This is the recurring "an appended line is byte-safe for first-line readers but breaks whole-string matchers" trap, and a reminder that a clearance is only as strong as the FILE SET the grep covered — name the directories you searched, and the ones you didn't.

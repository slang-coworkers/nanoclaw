---
title: "gh CLI Output Channels & Filter Encodings"
type: concept
group: ci-tooling
tags: [gh-cli, github, pr, issues, workflow, bot-process, slang]
source_count: 7
---

# gh CLI Output Channels & Filter Encodings

How `gh api` and `gh search` mislead a script through their output channels and date-filter encodings — and the discipline (positively-shaped results, failure exits kept off the negative-answer branch) that catches the lie.

## TL;DR
- **`gh api` is not a clean instrument.** On a 4xx it writes the error body to **stdout** (so the process looks like it produced output), and a script that tests only for emptiness can never detect the failure.
- **`$(cmd || echo default)` does NOT substitute when `cmd` still prints.** Because `gh api` prints the 404 body to stdout while failing, the `|| echo` branch never fires and `-z` guards sail past. Use `V=$(cmd) || V=x` (branch on the exit code), not `V=$(cmd || echo x)`.
- **`--jq '.conclusion'` prints a JSON `null` as an empty line** — which reads as "no value" rather than "not finished." A poll loop testing `!= "null"` exits instantly on a still-running job.
- **`gh search` date filters fail three distinct ways depending on encoding**, and the `>=`/`<=` forms need care. The encoding depends on the INVOCATION FORM; on `actions/runs` the wrong form returns a SILENT `total_count=0`; pre-encoding `%3E%3D` is the wrong fix for `-f`; and a missing colon silently returns a plain result set.
- **Rule: require a positively-shaped result** — a bare integer, a known enum — rather than testing for absence, and never let a command's failure exit share a branch with its negative answer.

## gh CLI output channels and filter encodings

`gh api` is not a clean instrument: on a 4xx it writes the **error body to stdout**, so a script that tests only for emptiness can never detect the failure ([Discriminator for the gh-404-stdout bug: `V=$(cmd || echo x)` is broken, `V=$(cmd) || V=x` is safe — plus where shape-validation is still required](../learnings/1786154661882-discriminator-for-the-gh-404-stdout-bug-v-cmd-echo.md)), and `--jq .conclusion` prints a JSON `null` as an **empty line**, which reads as "no value" rather than "not finished" — a poll loop testing `!= "null"` exits instantly on a still-running job ([`$(cmd || echo default)` does NOT substitute when cmd still prints — gh api writes 404 bodies to stdout, silently killing your error-handling branch](../learnings/1786154083155-cmd-echo-default-does-not-substitute-when-cmd-stil.md), [gh --jq '.conclusion' prints JSON null as an EMPTY LINE — a poll loop testing != "null" exits instantly on a running job](../learnings/1786136595995-gh-jq-conclusion-prints-json-null-as-an-empty-line.md)). A `cmd || echo default` guard does not substitute when the command still exits 0 while printing an error ([Correction: `gh api` writes 404 error bodies to STDOUT — "|| echo ''" does NOT yield an empty string, so -z guards sail past](../learnings/1786153961374-correction-gh-api-writes-404-error-bodies-to-stdou.md)). Date filters in `gh search` fail in three distinct ways depending on encoding, and the `>=`/`<=` forms need care — two corrections were needed before the working form was pinned: the encoding depends on the INVOCATION FORM, and on `actions/runs` the wrong form returns a SILENT `total_count=0`; pre-encoding `%3E%3D` is the wrong fix for `-f`, and a missing colon silently returns a plain result set ([Split "this is yours to fix" from "here is the mechanism" — the second is usually unmeasured, and its falsity can sink the correct first claim](../learnings/1786150840441-split-this-is-yours-to-fix-from-here-is-the-mechan.md), [CORRECTION to my %3E%3D advice: gh date-filter encoding depends on the INVOCATION FORM, and on actions/runs the wrong form returns a SILENT total_count=0](../learnings/1786138106697-correction-to-my-3e-3d-advice-gh-date-filter-encod.md), [CORRECTION: gh search date filters fail three different ways — pre-encoding %3E%3D is the WRONG fix for -f, and a missing colon silently returns a pla](../learnings/1786137952135-correction-gh-search-date-filters-fail-three-diffe.md)).

**Rule: require a positively-shaped result (a bare integer, a known enum) rather than testing for absence, and never let a command's failure exit share a branch with its negative answer.**

**Source learnings (7):**
- [Discriminator for the gh-404-stdout bug: `V=$(cmd || echo x)` is broken, `V=$(cmd) || V=x` is safe — plus where shape-validation is still required](../learnings/1786154661882-discriminator-for-the-gh-404-stdout-bug-v-cmd-echo.md)
- [`$(cmd || echo default)` does NOT substitute when cmd still prints — gh api writes 404 bodies to stdout, silently killing your error-handling branch](../learnings/1786154083155-cmd-echo-default-does-not-substitute-when-cmd-stil.md)
- [Correction: `gh api` writes 404 error bodies to STDOUT — "|| echo ''" does NOT yield an empty string, so -z guards sail past](../learnings/1786153961374-correction-gh-api-writes-404-error-bodies-to-stdou.md)
- [Split "this is yours to fix" from "here is the mechanism" — the second is usually unmeasured, and its falsity can sink the correct first claim](../learnings/1786150840441-split-this-is-yours-to-fix-from-here-is-the-mechan.md)
- [CORRECTION to my %3E%3D advice: gh date-filter encoding depends on the INVOCATION FORM, and on actions/runs the wrong form returns a SILENT total_coun](../learnings/1786138106697-correction-to-my-3e-3d-advice-gh-date-filter-encod.md)
- [CORRECTION: gh search date filters fail three different ways — pre-encoding %3E%3D is the WRONG fix for -f, and a missing colon silently returns a pla](../learnings/1786137952135-correction-gh-search-date-filters-fail-three-diffe.md)
- [gh --jq '.conclusion' prints JSON null as an EMPTY LINE — a poll loop testing != "null" exits instantly on a running job](../learnings/1786136595995-gh-jq-conclusion-prints-json-null-as-an-empty-line.md)

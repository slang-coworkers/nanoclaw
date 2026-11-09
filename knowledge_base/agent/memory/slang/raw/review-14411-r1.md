---
type: source
description: "slang-reviewer r1 combined review of PR #14411 (head 8f77b57a3): APPROVE_WITH_NITS, 0 bugs/gaps; mutation drills d1-d4 each fail the new test; full suite 11678/11681 (3 fp8-cuda fail on master too); nits N1-N3 comment/rename only"
okf_synth: exempt
---
# Combined PR Review — shader-slang/slang#14411 (pr, head 8f77b57a3)

## Lead reviewer — verification and synthesis (slang-reviewer)

**Verdict: APPROVE_WITH_NITS.** 0 bugs, 0 gaps. The nits are comment and naming only; apply them without another review round.

**Maintainer direction (verified live 2026-11-08):** none. Only nv-slang-bot and other bots have commented on #14407 or #14411. This agrees with the fixer's self-check. Issue requirement from the reporter's body ("the indented `//TEST_INPUT:` is honoured ... and the output is `2.0`"): **met** at `tools/render-test/shader-input-layout.cpp:1050-1056`, tested by `tests/compute/entry-point-uniform-params-indented-test-input.slang`.

**What I ran** (Release, L40S, my own builds: head 8f77b57a3, master ae4e57957):
- New test on master: 0/3 (cpu, vk, cuda FAILED; the in-process run dumps core). On the head: 3/3, both in-process and with `-use-test-server` (metal ignored on Linux).
- Mutation drills on the head. I rebuilt render-test with each variant and ran the new test; every one fails 0/3, so the test pins each part of the rule:
  - d1, no extra-`/` strip: `c` unbound.
  - d2, no `trimStart`: `a` and `b` unbound.
  - d3, strips `/` and spaces in one loop: `could not find shader parameter matching 'decoy'`.
  - d4, indent strip handles spaces only: the tab-indented `b` unbound.
- Full suite on the head (`-use-test-server -server-count 4`): 11678/11681, 3264 ignored. The 3 failures are `tests/cooperative-matrix/fp8-cuda{,-e5m2,-half-acc}.slang (cuda)`, and they also fail 0/3 on master.
- `git grep` over the whole repo: no tracked file has a TEST_INPUT line whose classification changes. The only indented hits are in a C++ raw string in `tools/slang-unit-test/unit-test-generic-interface-conformance.cpp`, which goes through `loadModuleFromSourceString`, not render-test. `source/slang/core.meta.slang:1055` (`/// //TEST_INPUT:`) stays inert under the new rule, and render-test never reads that file.
- No other TEST_INPUT parser exists in `tools/` or `source/`. No doc describes the column-0 rule, so no doc needs an update.
- I checked the "same rule as slang-test" claim. `UnownedStringSlice::trimStart`/`trim` strip only space and tab (`source/core/slang-string.cpp:192-210`, `CharUtil::isHorizontalWhitespace`), which matches `skipHorizontalSpace`, and the `/` loops are the same. clang-format 17 is clean on the changed file.

**Nits (tested patch: `pr14411-r1-nits.patch`, applies to 8f77b57a3, clang-format clean, new test plus `entry-point-uniform-params.slang` pass 6/6 after rebuilding render-test and slang-test):**
- N1 (A and C001): the comment says "the same comment prefixes as slang-test's scan" but doesn't state the rule, doesn't name `_gatherTestsForFile`, and doesn't mention the `// //TEST_INPUT:` negative case that the decoy depends on. slang-test has no pointer back. The patch states the rule, names the function, records why `// //` stays a comment, and drops the "rather than being silently dropped" narration of the old behaviour.
- N2 (C FG001): `directive` holds comment text that isn't known to be a directive yet. The patch renames it `commentText`.
- N3 (A and C): a back-pointer comment in `tools/slang-test/slang-test-main.cpp:672`, so a change to either scan is visible from the other.

**Disagreements:**
- C says render-test's `trim()` also strips `\r`. That is wrong: `trim()` strips only space and tab. A is right that a CRLF line keeps a trailing `\r`. This is pre-existing, not in this diff, and harmless today: CRLF test files with TEST_INPUT, such as `tests/compute/assoctype-lookup.slang`, pass.
- A, B and C agree that there are no bugs.

**Test gaps / merge conditions:**
- The `-metal` lane runs only on macOS CI. CI run 42472992584 was `waiting` at review time and the draft-PR checks were skipped, so let CI finish before merge.
- I don't propose any further tests. The drills show the existing test separates each case.

**Out of scope (no action):** the unbound-parameter diagnostic is #14409. `Misc::Split` drops empty lines, so `lineNum` undercounts in the error message; that is pre-existing (A).

## Reviewer A — Correctness (nv-slang-bot)

I'm not posting any bugs or gaps for PR 14411. There is one clarity comment, on the new prefix-parsing block. Both reviewers and all five clarity steps finished; nothing was posted to GitHub, and nothing was built or run, since the PR branch isn't checked out locally.

**What was dropped:** three code-quality nits (confidence 30–55) and two pre-existing issues (`Misc::Split` drops empty lines so `lineNum` undercounts; CRLF leaves a trailing `\r`). Also dropped: the test-coverage reviewer's note that a `///TEST_INPUT:` line at column 0 is now treated as a directive. That change is the point of the PR and is in its title, and the reviewers found no existing test that relies on the old behaviour. The reviewers also checked that the test's `decoy` line really would fail the run if it were parsed.

---

**Verdict**: ✅ Clean — no significant issues found

The PR changes `ShaderInputLayoutParser::parse` in render-test so that a `TEST_INPUT:` line is recognised when it is indented or written with extra slashes (`///`). It uses the same prefix rule as slang-test's directive scan. A new CPU/VK/CUDA/Metal compute test covers spaces, a tab, `/// TEST_INPUT:`, and a commented-out `// //TEST_INPUT:` that must stay disabled. I found no existing test under `tests/` whose `TEST_INPUT` handling changes. There is one inline clarity comment on how the duplicated prefix rule is documented.

<details>
<summary>Changes Overview</summary>

**render-test TEST_INPUT prefix parsing** (`tools/render-test/shader-input-layout.cpp`)
- What changed: before, a line counted only if it began with `//` at column 0, and exactly two slashes were stripped. Now leading spaces and tabs are trimmed, `//` is required, any further `/` are skipped, and the rest is trimmed before matching `TEST_INPUT:`. This mirrors `_gatherTestsForFile` in `tools/slang-test/slang-test-main.cpp:664-677`.

**Regression test** (`tests/compute/entry-point-uniform-params-indented-test-input.slang`)
- What changed: a new compute test binds three entry-point `uniform StructuredBuffer<float>` parameters. Their `TEST_INPUT` lines are written space-indented, tab-indented and as `/// TEST_INPUT:`. A `// //TEST_INPUT:` decoy names a parameter that doesn't exist, so the run would fail if the decoy were parsed. FileCheck expects `2.0`, `3.0`, `4.0`.

</details>

<details>
<summary>Findings (1 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 💬 Clarity | `tools/render-test/shader-input-layout.cpp:1047` | The prefix rule is a second hand-written copy, linked to slang-test only by an unnamed reference, and the rejected `// //TEST_INPUT:` form is undocumented |

</details>

<sub>reviewed: 8f77b57a3b58e7951f6e9efb0236077427732aec · diff sha256 d07c36b43102</sub>

---

### `tools/render-test/shader-input-layout.cpp:1047`

💬 **Clarity**: The duplicated prefix rule has an unnamed cross-reference and doesn't document what it rejects

#14407 happened because render-test's "is this line a directive?" rule drifted away from slang-test's. This fix still leaves two hand-written copies. The only link between them is the phrase "slang-test's `//TEST` scan":
- it doesn't name the function (`_gatherTestsForFile`, `tools/slang-test/slang-test-main.cpp:664-677`);
- slang-test has nothing pointing back here.

So the next change to either scanner can bring the drift back without anyone noticing.

The comment also describes only what is accepted. `// //TEST_INPUT:` stays disabled only because of the order of operations:

```cpp
            directive = directive.tail(2);
            while (directive.startsWith("/"))
                directive = directive.tail(1);
            line = directive.trim();
```

Extra `/` are stripped *before* whitespace is trimmed, and never after it. The new test's `decoy` line depends on that ordering, but the code comment doesn't mention it. A loop that strips slashes and spaces repeatedly looks equivalent, but it would switch on every commented-out `TEST_INPUT` directive.

**Suggestion**:
- In this comment, name the slang-test function, and add a matching pointer in `_gatherTestsForFile` back to this parser.
- State that `// //TEST_INPUT:` is deliberately not a directive, and that this follows from stripping slashes before whitespace.
- Optionally, if you think it's in scope, move the rule into one small shared helper used by both tools so there is a single source of truth.

## Reviewer B — Devin Review

# Devin Review

## AI Analysis

render-test now recognizes //TEST_INPUT: lines that are indented or written with extra slashes. Previously such lines were silently dropped, leaving shader parameters unbound.

Trims leading whitespace before checking for the // comment prefix in shader-input-layout parsing.
Strips any additional leading slashes after // before reading the directive body.
Adds a compute test covering tab-indented, ///, and commented-out decoy directives across cpu, vk, cuda, and metal.

Summary: render-test dropped a //TEST_INPUT: line that was indented or written ///, so the parameter ran unbound (vk read 0, cpu/cuda crashed slang-test). It now uses the same prefix rule as slang-test's //TEST scan.

Root cause: tools/render-test/shader-input-layout.cpp:1047 tested startsWith("//") on the raw line; tools/slang-test/slang-test-main.cpp:664-677 skips spaces, tabs and extra / first.

Tests: new tests/compute/entry-point-uniform-params-indented-test-input.slang: 0/3 before, 3/3 after (cpu, vk, cuda on L40S). With -use-test-server, tests/compute/ passes 639/639 and tests/render/ 6/6.

Risk: test harness only. No existing test (other than the new one) has an indented or /// TEST_INPUT line, so existing tests are unchanged. Unbound-parameter diagnostics are #14409.

Fixes #14407

🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.

Show less
46 lines left
1
Accept indented and /// TEST_INPUT directives in render-test
0/1
shader-input-layout.cpp
tools/render-test
+9
−2
Viewed
All 79 lines
5 lines
80
struct ShaderInputLayoutParser
5 lines
All 956 lines
5 lines
1037
    RefPtr<ShaderInputLayout::AggVal> parse(const char* source)
All 4 lines
1042
        auto lines = Misc::Split(source, '\n');
1043
        int lineNum = 0;
1044
        for (auto& line : lines)
1045
        {
1046
            lineNum++;
1047
            if (!line.startsWith("//"))
1047
            // We accept the same comment prefixes as slang-test's `//TEST` scan, so an
1048
            // indented `//TEST_INPUT:` (e.g. next to an entry-point parameter) or a
1049
            // `///TEST_INPUT:` is a directive rather than being silently dropped.
1050
            UnownedStringSlice directive = line.getUnownedSlice().trimStart();
1051
            if (!directive.startsWith("//"))
1052
                continue;
1049
            line = line.getUnownedSlice().tail(2).trim();
1053
            directive = directive.tail(2);
1054
            while (directive.startsWith("/"))
1055
                directive = directive.tail(1);
1056
            line = directive.trim();
5 lines
All 16 lines
5 lines
1073
 
1074
        // TODO: check that stack has been maintained correctly...
1075
 
1076
        return rootVal;
1077
    }
1078
};
5 lines
All 631 lines
2
Add regression test for indented and /// TEST_INPUT
0/1
End of changes
Chat about this PR
Info
Chat

## Vulnerabilities

(none reported)

## Bugs

(none reported)

## Flags

(none reported)

## Informational

(none reported)

## Reviewer C — Clarity

The clarity pipeline for PR 14411 finished. It found two comments worth posting. I checked the file by hand rather than with the posting script's `--dry-run`, which needed an approval I didn't have; nothing was posted.

# PR 14411 Clarity Review Candidates

## PR Summary

- Title: "render-test: accept indented and /// TEST_INPUT directives" (Fixes #14407). +44 / −2 across 2 files.
- Stated intent: render-test's `ShaderInputLayoutParser::parse` used to recognize a `//TEST_INPUT:` line only if `//` was in column 0. An indented line, or one written `///`, was skipped silently and the parameter ran unbound. The PR makes render-test use the same prefix rule as slang-test's `//TEST` scan.
- What the diff does: in `tools/render-test/shader-input-layout.cpp`, the parser strips leading spaces/tabs (`trimStart()`), requires `//`, strips any further `/`, then `trim()`s and checks for `TEST_INPUT:` as before. It also adds `tests/compute/entry-point-uniform-params-indented-test-input.slang`, which covers space indent, tab indent, `/// TEST_INPUT:`, and a commented-out `// //TEST_INPUT:` decoy, on cpu/vk/cuda/metal.
- Description vs. diff: they match. I checked the "same rule" claim against `_gatherTestsForFile` in `tools/slang-test/slang-test-main.cpp`. `UnownedStringSlice::trimStart` and `skipHorizontalSpace` both strip only spaces and tabs, and both scanners skip extra `/` the same way. The decoy claim in the test header also holds: `assign` in `render-test-main.cpp` fails with "could not find shader parameter matching '%s'" for an unknown name.
- Value: a small, well-targeted harness fix with a good regression test. Directives that were silently ignored now take effect, which turns hard-to-diagnose crashes and zero reads into correct binding.

## Review Body

> Claude Opus 5.5-authored clarity review:
>
> This is a small, focused harness fix and it's close to merge-ready. The diagnosis is right, the change is minimal, and the new test is well built. Its header comment explains each variation it covers (space indent, tab indent, `/// TEST_INPUT:`, and the commented-out decoy), and I confirmed the decoy really would fail the test if it were parsed.
>
> ## Main Concerns
>
> - **The "same rule as slang-test" contract.** The new comment justifies the parsing by pointing at slang-test's `//TEST` scan, but it doesn't say what that rule is, and slang-test has no note pointing back here. A reader can only check the claim by comparing the two loops by hand, and a later change to either one would bring back the exact drift this PR fixes. Stating the accepted shape (including the `// //TEST_INPUT:` negative case) and making the coupling visible from both sides would make it hold up over time.
> - **Local naming.** `directive` and `line` swap roles over the stripping steps. The slice is called `directive` before anything has shown it to be one, and `line` ends up holding comment text while the error path still reports it as the source line. A clearer name, or parsing straight from the slice, would make the hand-off obvious.
>
> Neither concern is about correctness. Both are about making the four new lines easy to trust and keep in sync.

## Kept

### C001: Prefix rule is duplicated across two tools and only defined by reference

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `tools/render-test/shader-input-layout.cpp:1047-1049`
- GitHub link: https://github.com/shader-slang/slang/pull/14411/files
- Overlap decision: Keep
- Overlap rationale: Absorbs FG002's point that the comment describes the old bug instead of stating the rule; FG001 is a separate local naming issue.
- Scope decision: Direct
- Scope rationale: The comment and the cross-tool equivalence it claims are both new in this PR.
- Judgment decision: Revise
- Judgment rationale: render-test and slang-test share only `core`/`compiler-core` (tools/CMakeLists.txt), so a shared helper would mean putting a test-harness concern into product libraries. The comment therefore leads with stating the rule and making the coupling visible, and mentions a shared helper only as an option.

Context:

```cpp
            // We accept the same comment prefixes as slang-test's `//TEST` scan, so an
            // indented `//TEST_INPUT:` (e.g. next to an entry-point parameter) or a
            // `///TEST_INPUT:` is a directive rather than being silently dropped.
            UnownedStringSlice directive = line.getUnownedSlice().trimStart();
            if (!directive.startsWith("//"))
                continue;
            directive = directive.tail(2);
            while (directive.startsWith("/"))
                directive = directive.tail(1);
            line = directive.trim();
```

Proposed comment:

> The correctness claim here is "the same comment prefixes as slang-test's `//TEST` scan", but the comment never says what that rule is, and the scan it points at (the loop in `_gatherTestsForFile` in `tools/slang-test/slang-test-main.cpp`) has no note pointing back here. To check the claim, a reader has to find that loop and compare it step by step with this one: `skipHorizontalSpace` against `trimStart()` (both strip only spaces and tabs), the `/` loops, and `skipHorizontalSpace` against `trim()`. If either side changes later, the two tools drift apart without anyone noticing, and that drift is exactly the bug this PR fixes.
>
> The second sentence also describes the old behavior ("rather than being silently dropped") instead of the rule. And "is a directive" is a bit strong, since a line only becomes a `TEST_INPUT` directive after the prefix check below.
>
> Could the comment state the accepted shape directly? Something like: optional spaces/tabs, `//`, any number of further `/`, optional whitespace, then `TEST_INPUT:`. It could also give the negative case the new test relies on: `// //TEST_INPUT:` is not a directive, so it can be used to comment one out. And it could name the exact slang-test function it has to stay in sync with, ideally with a matching note on the slang-test side. Pulling the rule into a shared helper would also work if the two tools can share one cheaply, but the main thing is that the rule is written down and the coupling is visible from both sides.

Notes:
The PR introduces the coupling between the two scanners. slang-test's own comment calls these spellings "malformed directives like ///TEST or // TEST", which frames them differently from the PR's "accepted" wording. I verified the two rules are equivalent: `UnownedStringSlice::trimStart` uses `CharUtil::isHorizontalWhitespace` (space/tab), matching `skipHorizontalSpace`. render-test's final `trim()` also strips `\r` and trailing whitespace, which is harmless (and needed for CRLF).

### FG001: `directive` / `line` names swap roles across the prefix-stripping steps

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: naming
- Location: `tools/render-test/shader-input-layout.cpp:1050-1057`
- GitHub link: https://github.com/shader-slang/slang/pull/14411/files
- Overlap decision: Keep
- Overlap rationale: A local naming and data-flow issue in the new statements, separate from C001's concern about the rule and the cross-tool contract.
- Scope decision: Direct
- Scope rationale: The PR adds `directive` and rewrites the hand-off into `line`, so the naming confusion comes from changed lines.

Context:

```cpp
            UnownedStringSlice directive = line.getUnownedSlice().trimStart();
            if (!directive.startsWith("//"))
                continue;
            directive = directive.tail(2);
            while (directive.startsWith("/"))
                directive = directive.tail(1);
            line = directive.trim();
            if (line.startsWith("TEST_INPUT:"))
```

Proposed comment:

> The names here don't match what the variables hold. `directive` is first the whole line minus its indentation, then the comment text after the slashes. In neither case is it known to be a directive yet; that check happens two lines later, and it runs on `line`, not `directive`. Meanwhile `line` gets overwritten with the comment body, so further down, `line` means "comment text" while `lineNum` and the `"Invalid input syntax at line N: <line>"` message still treat it as the source line. A reader has to follow both variables through the reassignments to see which one gets tested and which one gets reported. A name that says what the slice actually is (the comment text after the `//` prefix) would fix this. So would keeping the slice as the only value that's checked and parsed, instead of copying it back into the loop's `String`.

Notes:
The in-place overwrite of `line` predates the PR (`line = line.getUnownedSlice().tail(2).trim();`), but the PR adds `directive` and makes the hand-off between the two variables more involved. No aliasing hazard: `String`'s constructor from `UnownedStringSlice` copies before the move-assignment.

## Dropped

### FG002: Comment describes the fixed bug rather than the rule

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tools/render-test/shader-input-layout.cpp:1047-1049`
- Overlap decision: Merged into C001
- Overlap rationale: Same comment block and the same request (state the rule, not the old bug), so it is folded into C001's revised comment.
- Scope decision: Direct
- Scope rationale: New comment added by the PR.

Proposed comment:

> "rather than being silently dropped" describes how the code used to behave, not what it does now. And "is a directive" is too strong, since a line only becomes a directive after the `TEST_INPUT:` check below. The comment would be clearer if it stated which line shapes are recognized and why the rule mirrors slang-test.

### FG003: Test header comment accuracy (audit)

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/compute/entry-point-uniform-params-indented-test-input.slang:1-7`
- Overlap decision: Keep
- Overlap rationale: No overlap; coverage-audit entry only.
- Scope decision: Direct
- Scope rationale: New test file, but there is no actionable concern: the header accurately maps each variation to `a`/`b`/`c`/`decoy`, and the decoy failure claim is confirmed by `assign` in `tools/render-test/render-test-main.cpp`.

Proposed comment:

> (Audit only.) The decoy claim checks out: `assign` in `tools/render-test/render-test-main.cpp` reports "could not find shader parameter matching" and returns `SLANG_E_INVALID_ARG` for an unknown name.

## Nits patch (pr14411-r1-nits.patch)

```diff
diff -ru a/tools/render-test/shader-input-layout.cpp b/tools/render-test/shader-input-layout.cpp
--- a/tools/render-test/shader-input-layout.cpp	2026-11-08 11:09:52.288269576 +0000
+++ b/tools/render-test/shader-input-layout.cpp	2026-11-08 11:10:05.321815961 +0000
@@ -1044,16 +1044,18 @@
         for (auto& line : lines)
         {
             lineNum++;
-            // We accept the same comment prefixes as slang-test's `//TEST` scan, so an
-            // indented `//TEST_INPUT:` (e.g. next to an entry-point parameter) or a
-            // `///TEST_INPUT:` is a directive rather than being silently dropped.
-            UnownedStringSlice directive = line.getUnownedSlice().trimStart();
-            if (!directive.startsWith("//"))
+            // A directive line is optional spaces or tabs, `//`, any further `/`, then
+            // `TEST_INPUT:` after optional spaces or tabs. This is the prefix rule of the
+            // `//TEST` scan in slang-test's `_gatherTestsForFile`; a line the two scans
+            // disagree on is skipped here without a diagnostic. Slashes are skipped only
+            // before the spaces, so `// //TEST_INPUT:` stays an ordinary comment.
+            UnownedStringSlice commentText = line.getUnownedSlice().trimStart();
+            if (!commentText.startsWith("//"))
                 continue;
-            directive = directive.tail(2);
-            while (directive.startsWith("/"))
-                directive = directive.tail(1);
-            line = directive.trim();
+            commentText = commentText.tail(2);
+            while (commentText.startsWith("/"))
+                commentText = commentText.tail(1);
+            line = commentText.trim();
             if (line.startsWith("TEST_INPUT:"))
             {
                 auto lineContent = line.subString(11, line.getLength() - 11);
diff -ru a/tools/slang-test/slang-test-main.cpp b/tools/slang-test/slang-test-main.cpp
--- a/tools/slang-test/slang-test-main.cpp	2026-11-08 11:09:52.290269660 +0000
+++ b/tools/slang-test/slang-test-main.cpp	2026-11-08 11:10:15.651248978 +0000
@@ -669,7 +669,9 @@
             continue;
         }
 
-        // Skip any extra slashes and spaces to handle malformed directives like ///TEST or // TEST
+        // Skip any extra slashes and spaces to handle malformed directives like ///TEST or // TEST.
+        // render-test's `ShaderInputLayoutParser::parse` uses the same prefix rule for
+        // `TEST_INPUT:` lines.
         while (*cursor == '/')
         {
             cursor++;
```

## Result (machine-readable)

```json
{"verdict":"APPROVE_WITH_NITS","bugs":0,"gaps":0,"questions":0,"diff_hash":"d07c36b43102cc4c7250d23f5da99b1cc0b8c2fb4cb0588cf6667d31a2f25253","reviewers_complete":true}
```

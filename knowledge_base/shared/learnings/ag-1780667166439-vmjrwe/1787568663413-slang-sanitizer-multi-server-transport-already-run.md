---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787565793093-np84lo
written_at: 2026-08-24T10:51:03.413Z
---

# Slang sanitizer multi-server transport already runs under ASan on PR CI

Claim under test (from #12707 triage): "the multi-server test-server transport is never exercised under ASan; the nightly sanitizer job passes server-count 1, and ci-slang-sanitizer.yml only adds -use-test-server when count>1." **This is FALSE at ToT** and was caught by reading the source.

The nightly (`nightly-slang-sanitizer-test.yml`) is NOT the only caller of `ci-slang-sanitizer.yml`. `.github/workflows/ci.yml:221` (`sanitizer-linux-clang-x86_64`) *also* calls it — on every non-draft, non-docs-only PR to master — and passes only `runs-on`, so `server-count` falls to its **default of 2** (`ci-slang-sanitizer.yml:9-12`). Since 2 > 1, `-use-test-server -server-count 2` is added (lines 255-258). So the multi-server transport under ASan **already runs on PR CI**.

The nightly's `server-count: 1` therefore uniquely covers the **in-process** path (no test server). Bumping the nightly 1→4 would *remove* that unique in-process ASan coverage while duplicating what PR CI already does — net-negative, not a coverage win.

**Lesson:** before "fixing" a CI coverage gap by editing one workflow, grep ALL callers of the reusable workflow (`uses: ./.github/workflows/<file>`) and check each caller's `with:` block for the inputs and their **defaults** — a reusable workflow's default input value can already provide the coverage a single caller appears to lack. A premise about "X never runs under Y" must be verified across every invocation path, not one file.

Verified 2026-08-24, shader-slang/slang @ bec577b36e.

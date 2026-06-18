# SLANG_ASSERT=release-assert-only gives FALSE "fixed" when triaging assert-failure ICEs

When re-triaging a Slang crash whose signature is `assert failure: <cond>` (a `SLANG_ASSERT`-class ICE) to check if it's fixed at ToT, **do NOT run slangc with `SLANG_ASSERT=release-assert-only`**. That env value *skips* debug-only `SLANG_ASSERT`/`SLANG_ASSERT_FAILURE` checks — i.e. it suppresses the exact assertion the bug trips — so a still-buggy compiler will silently exit 0 and look "fixed."

**Why:** The default (env unset) behavior throws an exception on the assert, faithfully reproducing the original `error 99999: ... assert failure: <cond>`. `release-assert-only` only keeps `SLANG_RELEASE_ASSERT`. So for an `SLANG_ASSERT` ICE, unset = real signal, release-assert-only = false negative.

**How to apply:** Verify assert-ICE fixes with `SLANG_ASSERT` **unset** (or `system`/`debugbreak` if you need a stack). Reserve `release-assert-only` for getting *past* an unrelated debug assert to inspect later-stage output — never as the harness for the very assert you're testing. (Observed re-triaging #8148, an `assert failure: parentNonBlock` ICE — a release-assert-only run showed exit 0 on all three repros; rerunning with the env unset was required to trust the "fixed" result, which then held up against a force-rebuilt ToT binary.)

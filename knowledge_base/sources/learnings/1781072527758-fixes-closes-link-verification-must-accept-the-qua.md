# Fixes/Closes link verification must accept the qualified cross-repo form

When verifying that a PR body links its issue (the `Fixes #N` / `Closes #N` artifact check used by the issue-chain supervisor and PR-review flows), the common regex `(?:Fixes|Closes|Resolves) #\d+` (a literal space then `#`) produces **false negatives** on the fully-qualified cross-repo form GitHub also honors:

```
Fixes shader-slang/slang-rhi#772
```

This is a valid closing keyword — for a same-repo PR it is equivalent to `Fixes #772` and WILL auto-close the issue on merge. There is an `owner/repo` token between `Fixes ` and `#N`, so the bare-`#` pattern misses it.

**Use a tolerant pattern** that allows an optional `owner/repo` qualifier between the keyword and `#`:

```
(?i)(fix(es|ed)?|close[sd]?|resolve[sd]?)\s+([A-Za-z0-9._-]+/[A-Za-z0-9._-]+)?#[0-9]+
```

**Concrete incident (2026-06-10, supervisor tick 19):** I flagged shader-slang/slang-rhi#773 as "PR body lacks `Fixes #772`" and nudged the fixer to amend — but the body already ended with `Fixes shader-slang/slang-rhi#772.` The fixer correctly declined. Lesson: before nudging anyone to "add a missing link," verify with a qualifier-tolerant pattern (or read the line), and remember slang-rhi/slangpy PRs frequently use the fully-qualified form because issues span repos.

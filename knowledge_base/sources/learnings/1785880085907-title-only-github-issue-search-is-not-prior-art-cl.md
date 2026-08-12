# Title-only GitHub issue search is not prior-art clearance

## Rule

Before claiming a finding is unreported, search GitHub issue **bodies and comments**, not just titles — and search by the *symptom* and the *source file*, not your own phrasing of the problem.

## What happened (2026-08-04, shader-slang/slang)

A Discord user reported the `[shader(...)]` attribute docs were missing RT stages. I root-caused it to a `//`-vs-`///` typo in `core.meta.slang` that makes the doc extractor drop a `@param` continuation line, searched issue titles for `shader attribute docs stage list`, got zero relevant hits, and wrote it up as a new confirmed finding.

It was a **duplicate ~10 months late**. Issue **#8672** ("A comprehensive list of all possible `[shader(...)]` attribute values", open since 2025-10-10, labeled `Dev Reviewed`) is the same request — and a commenter had **already published the identical root cause** on 2025-10-14, noting the doc page "ends in a comma" and citing the same split `@param` in `core.meta.slang`.

## Why the search missed

#8672's title is *"comprehensive list of all possible values"*. It contains **no** `docs` / `documentation` / `truncated` / `missing` token. Any title-only query built from my own framing of the bug ("docs truncated") could not match a title framed as a feature request ("give me a list"). The same defect gets described two ways: **"the docs are wrong"** vs **"I can't find a list"**.

## What to do instead

- Search the **symptom as a user would phrase it**, not as you'd phrase the fix: try both "docs are wrong" and "where is the list / how do I find".
- Search the **source filename** (`core.meta.slang`) and the identifier (`[shader(`) — a prior reporter who dug into the cause will have named the file in the body, even if the title is vague.
- GitHub search syntax: default searches title+body; add `in:comments` for comment text. Run at least one query without `in:title`.
- Treat "0 hits" from a single narrow query as **weak** evidence. If you must publish before an exhaustive search, label it a hypothesis — and then actually go falsify it, because an unfalsified hypothesis published as a finding reads to the reader as a fact.

## The salvage

A duplicate discovery isn't worthless — it just isn't a new issue. Ask what's *additive* over the existing thread and post that as a comment: in this case the current line numbers (the old ones had shifted), that the defect was duplicated in a second block, and that the existing thread pointed at the **wrong namespace** (`slang-profile-defs.h`, the `slangc -stage` table) when the attribute actually resolves through the capability system.

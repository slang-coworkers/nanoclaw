---
title: "gh CLI --field expands @ as file path"
type: learning
topic: ci-tooling
source: learnings/1778859843367-gh-cli-field-expands-as-file-path.md
---

# gh CLI --field expands @ as file path

# `gh api --field` treats values starting with `@` as file paths

When using `gh api ... --field body="..."`, gh interprets a leading `@` as "read this from a file." This breaks any GitHub comment that starts with a user mention, e.g.:

    --field body="@swoods-nv thanks for the review..."

…produces a `file name too long` error because gh tries to open `@swoods-nv thanks for ...` as a path.

**Workarounds (any of these work):**

1. **Pipe a JSON object via stdin** — most reliable for multi-line markdown:
   ```bash
   jq -Rs '{body: .}' < /tmp/comment.md \
     | gh api repos/OWNER/REPO/issues/N/comments --method POST --input -
   ```
2. **Use `--raw-field` / `-f`** — disables `@` expansion (but still does `key=value` parsing).
3. **Lead the body with a zero-width or different character**, then a mention — fragile, don't do this; prefer 1 or 2.

**How to apply:** Whenever a GH comment body starts with `@<username>` (very common for bot replies), use the stdin/JSON path. Don't trust `--field body="..."` for arbitrary user-authored text.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1778859843367-gh-cli-field-expands-as-file-path.md`_

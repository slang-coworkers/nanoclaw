---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785460265092-wnqeus
written_at: 2026-09-12T00:51:27.841Z
---

# Never inline a hand-retyped patch in a PR body — git apply --check the exact bytes

**Correction from a maintainer (shader-slang/slang#13021, 2026-09-12).** A workflow-notices patch I put in a PR body as an inline ```diff block was **malformed** — wrong hunk line counts — so `git apply` rejected it with "corrupt patch at line 54," and the maintainer had to hand-apply instead.

**Root cause:** the generated patch FILE (`git diff master HEAD -- <files>` → `.patch`) was valid and `git apply --check` passed on it. But for the PR body I **hand-retyped/trimmed** the diff into a fenced block (dropped the `index` lines, and the `@@ -a,b +c,d @@` hunk counts no longer matched the actual line counts). Hand-editing a unified diff almost always corrupts the hunk headers.

Also note: a **codex OUTPUT_REVIEW compared the inline block to the .patch and called it "matches semantically"** — semantic-equivalence review does NOT validate patch format. Only `git apply --check` does.

**Rules going forward:**
- Never hand-assemble or hand-retype a patch. Generate it from a real `git diff` / `git format-patch`.
- Before putting a patch in a PR body OR handing it off, run **`git apply --check <patch>` against the exact target branch** and confirm it passes.
- If you must show a patch inline, paste the **exact bytes** of the verified file (don't trim `index`/`---`/`+++` lines or reflow) — or better, attach the `.patch` file / link it and don't inline. An inline diff that a reader will `git apply` must be byte-identical to a checked patch.
- Prefer handing off the attached `.patch` file as the source of truth over an inline copy; if both exist, they must be identical.

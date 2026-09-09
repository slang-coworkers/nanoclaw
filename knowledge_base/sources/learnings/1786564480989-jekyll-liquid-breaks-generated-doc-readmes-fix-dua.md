---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786522882944-tavoyq
written_at: 2026-08-12T19:54:40.989Z
---

# Jekyll Liquid breaks generated-doc READMEs; fix dual-render-safely at the producer

**Context:** shader-slang/slang GitHub Pages build was red ~5 days because a generated README (`docs/generated/tests/coverage/lower-to-ir/README.md`) contained `float2x2 m = {{1,2},{3,4}}` in a code span.

**Why it breaks (non-obvious):** Any markdown file with YAML front-matter is a Jekyll *page*, and Jekyll runs **Liquid over the whole body BEFORE Markdown** — so a `{{` even inside a fenced/inline code span is still a Liquid output tag. Liquid's scan for the closing `}}` is **non-greedy**: in `{{1,2},{3,4}}` it stops at the first single `}`, leaving the tag unterminated → *"Variable … was not properly terminated"* → the **entire site build aborts** (one bad file kills the whole Pages build). A *terminated* `{{...}}` (e.g. FileCheck `{{.*}}`) is non-fatal but still evaluated → renders empty (silent corruption).

**Dual-render trap:** these files are viewed on github.com (GitHub-Flavored Markdown, Liquid NOT processed) AND on Pages (Liquid). So the obvious fixes are wrong: `{% raw %}…{% endraw %}` and HTML entities *inside a backtick code span* both render **literally** on github.com. What IS dual-safe: (a) **space the braces** where whitespace is semantically irrelevant (`{ {1,2} }`); (b) numeric brace entities inside a **raw `<code>` element** — `<code>&#123;&#123;.*&#125;&#125;</code>` renders as literal `{{.*}}` on both surfaces (GFM decodes entities inside real `<code>` tags but NOT inside backtick spans, and Liquid never sees a `{{`).

**Jekyll versions:** classic GitHub Pages = Jekyll **3.10**, which has **no per-file `render_with_liquid`** (that's 4.0+). A file with NO front-matter is copied verbatim (no Liquid) but then isn't a rendered page.

**Producer-fix pattern when the "generator" is an LLM, not code:** if generated files are authored out-of-band by an agent and only *linted* by a script, the durable fix = add a **lint rule** (hard CI gate) that rejects the hazard + a **prompt rule** teaching the safe spelling + fix existing occurrences. (shader-slang draft PR #12511.)

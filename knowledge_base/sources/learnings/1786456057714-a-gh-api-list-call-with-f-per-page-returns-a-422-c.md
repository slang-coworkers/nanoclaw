---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786453378919-tl2494
written_at: 2026-08-11T13:47:37.714Z
---

# A gh api list call with -f per_page returns a 422 CREATE error body that reads as an empty list

Measured 2026-08-11 on shader-slang/slang#12474 triage.

`gh api repos/O/R/labels -f per_page=100 --paginate --jq '.[].name'` **does not list labels**. Because
`-f` adds a *body* field, `gh` switches the request to POST, hitting the label-CREATE endpoint:

```
{"message":"Invalid request.\n\n\"name\" wasn't supplied.", ... "status":"422"}
gh: Invalid request. "name" wasn't supplied. (HTTP 422)
```

That is **3 lines of stderr/stdout**, so `wc -l` on the captured output reported `total labels: 3`,
and every `grep -cxF '<label>'` against it returned **0**. I was one step from concluding that
`spirv_vulkan`, `reproduced`, `bug`, `SPIR-V` and `Dev Opened` *do not exist in the repo* and
skipping labelling entirely. Correct form (`-X GET` makes `per_page` a query param):

```bash
gh api -X GET repos/O/R/labels -f per_page=100 --paginate --jq '.[].name' > labels.txt
wc -l < labels.txt        # 82, not 3
grep -cxF 'spirv_vulkan' labels.txt   # 1
```

All five names existed. The failure is silent in the direction of *absence*, which is the dangerous
direction for a "does this label exist?" check — a false zero makes you omit metadata rather than
error out.

**Rules**
1. On any `gh api` **list** endpoint, pass query params with `-X GET -f k=v` (or `?k=v`). A bare
   `-f` on a GET-shaped path silently becomes a POST.
2. **Assert the response SHAPE before scoring its contents.** `jq -e 'type=="array"'` would have
   failed loudly here. An error body occupying a data column is the recurring shape: same family as
   `--paginate` tallying an auth-error body as a data value, and `grep -c` over a rate-limit JSON.
3. `wc -l` is not a record count for any format whose records can wrap or whose error path emits
   prose. Count records by their key field.
4. The tell that caught it: **an implausible magnitude.** "3 labels" for a repo of this size is
   impossible, and impossibility is cheaper to notice than any individual wrong `0`. Sanity-check
   the magnitude against what you already know before believing a probe.

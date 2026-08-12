# gh api silently switches to POST when -F/-f is passed without -X GET

## The trap

`gh api <path> -F per_page=40` on a **GET** endpoint returns `404 Not Found`. Not a permissions problem, not a wrong path — `gh api` **switches the HTTP method to POST** as soon as any `-F`/`-f` parameter is present and no `-X` is given. The params become a JSON request *body* instead of a query string, and `POST /repos/{o}/{r}/actions/workflows/{id}/runs` doesn't exist ⇒ 404.

Measured 2026-08-05 on `shader-slang/slang`, all four in one pass:

| form | result |
|---|---|
| `gh api ".../actions/workflows/ci.yml/runs" -F per_page=2` | **404** |
| `gh api -X GET ".../actions/workflows/ci.yml/runs" -F per_page=2` | `17410` ✅ |
| `gh api ".../actions/workflows/ci.yml/runs?per_page=2"` | `17410` ✅ |
| `gh api search/issues -f q='…' -F per_page=1` (control, different endpoint) | **404** |

The last row matters: it is **not** specific to the Actions API. Any GET endpoint behaves this way.

## Why it is worse than a normal error

The 404 body is valid JSON, so it flows straight into a pipeline:

```bash
gh api ".../runs" -F per_page=60 --jq '.workflow_runs[] | .id' > rids.txt   # 404 JSON
wc -l < rids.txt                                                            # "4"  <- looks like 4 runs!
```

`wc -l` counted the four lines of the pretty-printed error object. Downstream, `for r in $(cat rids.txt)` iterated over `{`, `"message":`, … and every subsequent call failed — and because those were wrapped in `2>/dev/null`, the loop produced a **0-row output file that read as a genuine finding** ("no Falcor failures in the pool"). Two independent silencers stacked: JSON-shaped error + suppressed stderr.

## How to apply

- **Always pass `-X GET` explicitly when using `-F`/`-f` on a read endpoint**, or put params in the query string (`?per_page=100`). Query-string form is the safer default — it cannot be re-methoded.
- **Never `2>/dev/null` a `gh api` call whose emptiness is load-bearing.** Check the exit code, and keep a known-nonempty control in the same probe.
- Tell for this specific bug: a row count that is a **small number like 4** (the line count of the error object) rather than 0 or a plausible count.

Related: `gh api` has **no `--arg` flag** (unlike `jq`) — `--jq '… $r …'` with `--arg r "$r"` exits 1 on every iteration for the same silent-empty-file outcome. Interpolate with `sed "s|^|$r\t|"` after the call instead.

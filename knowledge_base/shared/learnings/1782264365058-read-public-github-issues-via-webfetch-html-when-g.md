# Read public GitHub issues via WebFetch HTML when GH_TOKEN is invalid

When the bot's `GH_TOKEN` is expired/invalid (`gh auth status` → "The token in GH_TOKEN is invalid"), every `gh` call silently returns NO output (not an error) — easy to mistake for an empty result. Confirm with `gh auth status` before trusting an empty `gh issue view`.

**Workaround for READ-ONLY needs:** GitHub issue/PR pages are public HTML, so `WebFetch("https://github.com/<owner>/<repo>/issues/<N>", prompt=...)` retrieves title, body, author, state, labels, and assignee with no token. This unblocked triage of #11719 (read sibling #11718 and the duplicate #11568, incl. their "Dev Reviewed" labels + assignee) entirely offline. WebFetch canNOT post/label/set-type — those stay blocked until the token is refreshed (escalate to parent/operator).

**Limits:** WebFetch may miss long comment threads or collapsed content; for a definitive duplicate sweep / comment history you still need `gh` once the token is back. But for "what is this issue and is it a dup" it's sufficient.

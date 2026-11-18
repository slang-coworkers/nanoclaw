# Credentials & External Services

Your HTTP requests go through the OneCLI proxy, which injects real credentials automatically. Just call any API directly (Gmail, GitHub, Slack, etc.) — the proxy adds auth before it reaches the service.

Use any method: curl, Python, a CLI tool, whatever fits. If a tool checks for credentials locally, pass any placeholder value — the proxy replaces it with real credentials at request time.

If a request fails with `app_not_connected` or `credential_not_found`, the error response contains a link (`connect_url`, or `secret_url` for an API key) — you MUST show it to the user as a bare URL on its own line (no angle brackets, no markdown link syntax) so they can click to connect. If it fails with `access_restricted`, OneCLI holds a credential for that host, but none this agent can use for that request. It may belong to another app on the host (Google apps share `www.googleapis.com`), so do not tell the user the service is connected: ask an admin to check that it is, connect it if not, and attach it to this agent. A retry fails until then. Run `/onecli-gateway` for the full error-handling flow. Never ask the user for API keys or tokens.

GitHub is the exception when the gateway already holds GitHub credentials for some paths. If reading the repository you will write to succeeds (`gh api repos/<owner>/<repo> --jq .id`), a `401`/`app_not_connected` from `gh auth status`, `gh api rate_limit` or another repository only means that path is not covered: it is not an outage, so do not show a connect link and do not wait on it. Check GitHub access only with that repository read.

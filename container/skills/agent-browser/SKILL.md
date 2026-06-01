---
name: agent-browser
license: MIT
description: Browse the web for any task — research, read articles, interact with web apps, fill forms, screenshot, extract data, test pages. Use whenever a browser would help, not just when explicitly asked.
allowed-tools: Bash(agent-browser:*)
---

# Browser Automation with agent-browser

## Browser vs API

Prefer `curl`/MCP when both exist — faster, cheaper: REST/GraphQL for the same data, JSON-only (no JS), or rate limits matter. Use the browser when no API exists (JS-rendered page, SaaS UI), you need visual confirmation, auth is session-based with no token, or a form/wizard is involved.

## Workflow

`open <url>` → `snapshot -i` (returns refs `@e1`…) → interact via refs → re-snapshot after navigation or DOM changes.

## Error handling

- `open` timeout/error: retry once, then report — don't loop.
- Snapshot `[]`: check `get url`; if redirected, re-snapshot.
- `fill`/`click` "element not found": re-snapshot for fresh refs (navigation/DOM mutations invalidate them).
- Redirected to login: re-authenticate and `state save`.
- After 3 failed attempts on the same action, stop and report with the last snapshot.

## Commands

### Navigation

```bash
agent-browser open <url>
agent-browser back
agent-browser forward
agent-browser reload
agent-browser close
```

### Snapshot (page analysis)

```bash
agent-browser snapshot            # Full accessibility tree
agent-browser snapshot -i         # Interactive elements only (recommended)
agent-browser snapshot -c         # Compact output
agent-browser snapshot -d 3       # Limit depth to 3
agent-browser snapshot -s "#main" # Scope to CSS selector
```

### Interactions (use @refs from snapshot)

```bash
agent-browser click @e1
agent-browser dblclick @e1
agent-browser fill @e2 "text"     # Clear and type
agent-browser type @e2 "text"     # Type without clearing
agent-browser press Enter
agent-browser hover @e1
agent-browser check @e1
agent-browser uncheck @e1
agent-browser select @e1 "value"  # Select dropdown option
agent-browser scroll down 500
agent-browser upload @e1 file.pdf
```

### Get information

```bash
agent-browser get text @e1
agent-browser get html @e1        # innerHTML
agent-browser get value @e1       # input value
agent-browser get attr @e1 href
agent-browser get title
agent-browser get url
agent-browser get count ".item"   # count matching elements
```

### Screenshots & PDF

```bash
agent-browser screenshot          # temp dir
agent-browser screenshot path.png
agent-browser screenshot --full   # full page
agent-browser pdf output.pdf
```

### Wait

```bash
agent-browser wait @e1                     # for element
agent-browser wait 2000                    # ms
agent-browser wait --text "Success"
agent-browser wait --url "**/dashboard"    # URL pattern
agent-browser wait --load networkidle
```

### Semantic locators (alternative to refs)

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
agent-browser find placeholder "Search" type "query"
```

### Auth, cookies, storage, JS

```bash
agent-browser state save auth.json        # after login; later: state load auth.json + open
agent-browser cookies                     # get all; set name value; clear
agent-browser storage local               # get; set k v
agent-browser eval "document.title"       # run JavaScript
```

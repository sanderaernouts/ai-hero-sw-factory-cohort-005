# Giving the agent a browser

This is how you drive a page in the app, and ask it questions.

It uses [agent-browser](https://github.com/vercel-labs/agent-browser), a CLI
built for exactly this — one command per action, an answer on stdout.

## Once, per machine

The agent workflows install it already. On your own machine:

```bash
npm install -g agent-browser
agent-browser install
```

## Asking your own question

Start the app with `npm run dev` first. The examples below use
`http://localhost:5173`, the dev server's default address — if `npm run dev`
printed a different one, use that.

A screenshot is pixels. To verify a fix you need a yes or a no, so read the
DOM:

```bash
agent-browser open http://localhost:5173/courses
agent-browser find placeholder "Search courses..." fill "typescript"
agent-browser find role button click --name "Search"

# Did the search reach the URL?
agent-browser get url

# How many course cards came back?
agent-browser get count 'a[href^="/courses/"]'

# What does the empty state say, if there is one?
agent-browser get text main

# Did anything break?
agent-browser errors
agent-browser console
```

The commands worth knowing: `open`, `click`, `fill`,
`find <role|text|label|placeholder> …`, `wait`, `get text|html|attr|count|url`,
`is visible|enabled|checked`, `eval`, `snapshot` (the accessibility tree, with
refs), `screenshot`, `console`, `errors`, `close`. `agent-browser --help` has
the rest.

**Ask the page, do not ask the person.** A change you have not looked at is a
change you are reporting on trust.

Screenshots are PR evidence: a before and an after for a change that shows in
the UI.

## Sign in as a user

The DevUI panel switches users by posting to `/api/switch-user`. Do the same
from the page:

```bash
agent-browser open http://localhost:5173/
agent-browser eval "fetch('/api/switch-user',{method:'POST',body:new URLSearchParams({userId:'5'})}).then(r=>r.status)"
```

In a freshly seeded database, user 5 is Emma Wilson, a Student enrolled in both
seeded courses. For another role, look it up:
`sqlite3 data.db "select id, name, role from users"`.

## Screenshots

Hide the DevUI panel first, so it does not cover the page:

```bash
agent-browser eval "document.querySelectorAll('[data-devui]').forEach(e=>e.remove())"
agent-browser screenshot "[data-slot=card]:has(textarea)" /tmp/evidence/after.png
```

For a "before" screenshot, run the base branch next to your own on another
port:

```bash
git worktree add /tmp/before origin/main
ln -s "$PWD/node_modules" /tmp/before/node_modules
cp data.db /tmp/before/
(cd /tmp/before && npx react-router dev --port 5174 > /tmp/before.log 2>&1 &)
```

Use `npx react-router dev` here, not `npm run dev`. When you are done, run
`git worktree remove --force /tmp/before`.

## Two things that will bite you

**Hydration lags "networkidle".** The button is in the server HTML before
React attaches its `onClick`, so the first click can be a silent no-op. Poll
for the click's effect and click again, rather than waiting a fixed time.

**Vite re-optimizes on the first load.** On a fresh checkout, the first page
load discovers dependencies Vite has not pre-bundled, and pushes a full-page
reload a moment after the response has finished. Absorb it once against a
throwaway load before the real loop; otherwise it lands mid-interaction and
every click after it hits a page that is already navigating away.

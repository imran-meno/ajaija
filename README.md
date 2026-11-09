# Ajaia Docs

A small collaborative document editor: create, rename, edit (rich text), upload, share and reopen documents.

## Run locally
Needs Node 18+.
```
npm install
npm start        # http://localhost:3000
npm test         # automated tests
```

## How to review the sharing flow
There is no password. Use the "Signed in as" dropdown at the top (Alice, Bob, Carol).
1. As **Alice**: click New document, write something, click Share, pick Bob.
2. Switch to **Bob**: the document is under "Shared with me" with a "from Alice" badge. Bob can open and edit it.
3. Switch to **Carol**: she cannot see it (the server returns 403).

## Features
- Create, rename, edit, save (button + autosave) and reopen documents
- Bold, italic, underline, heading, subheading, bullet and numbered lists
- Upload `.txt` or `.md` (max 500 KB) to create a new editable document
- Owner can share with another user; owned and shared documents are listed separately
- Data is stored in `data.json`, so documents survive refresh and restarts

## Deploy (Render)
New Web Service from the repo: build `npm install`, start `npm start`. Optionally set `DATA_FILE` to a path on a persistent disk.
Note: on Render's free tier the disk is reset on redeploy, so use a persistent disk (or reseed) if data must last.

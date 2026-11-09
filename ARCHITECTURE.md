# Architecture note

**Stack:** Express (Node) API + plain HTML/JS front end served as static files + a JSON file for storage. One service, one command to run, no paid dependencies.

**What I prioritised**
1. The full loop working end to end: create, edit, save, reopen, share.
2. Server-side access rules. Every document route checks owner or shared user, so the rules are not only in the UI. Only the owner can share.
3. Clear validation and error messages (title length, empty title, file type, file size, unknown user).
4. A test for the access logic, since that is the part most likely to break.

**Decisions**
- Rich text uses a `contenteditable` div with browser formatting commands. It is quick and dependable for the basics. The content is saved as HTML so formatting is kept.
- Mock login with 3 seeded users, sent as an `x-user-id` header. It is not secure on purpose, because the brief allows mocked auth.
- Basic HTML cleanup removes `<script>` tags and `on...=` attributes, because shared users render each other's HTML.
- Upload turns `.txt` and `.md` into a new document (simple markdown: `#`, `##`, `-`).

**Cut on purpose:** real auth, real-time collaboration, `.docx` import, comments, version history, undo across saves, permission levels (shared users can edit).

**Next with 2-4 more hours:** swap to TipTap for a better editor, SQLite or Postgres, `.docx` import with mammoth, view-only vs edit sharing, an HTML sanitizer library (DOMPurify), and version history.

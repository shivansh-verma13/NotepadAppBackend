# Notes API

Backend source for Shivansh Verma's private notes product, paired with MERN-NotePadApp-Frontend. The upgrade/notes-v1 branch preserves the original Express/Mongoose/JWT stack and endpoint contracts while modernizing one verified slice at a time. First slice: reliable, validated, owner-scoped atomic note mutations. It is not yet a verified hosted release or AI product.

## Local setup
Node 22+, npm ci. Configure MONGODB_URL, JWT_SECRET and COOKIE_SECRET in an ignored .env file; never commit real values. npm start defaults to port 4040 after a successful database connection. Configure exact FRONTEND_ORIGINS; cookies are host-only, and writes require an allowed Origin plus X-Notes-Request: 1. See [local integration and paired deployment contract](docs/LOCAL_INTEGRATION.md). Use synthetic local data until browser and hosted checks pass.

## API and storage
/notepad/notes/all-notes (GET), /newNote (POST title/content), /updateNote (PATCH noteID/content), /deleteNote/:noteID (DELETE), under the same prefix. Signed JWT cookies identify the owner. Embedded notes retain original IDs; no migration or deletion was run. Atomic push/set/pull prevent whole-array overwrites. New notes: title 1–120 characters, content 1–20,000, at most 200 notes; legacy over-limit accounts remain readable/editable/deletable. A missing/foreign note returns 404. Controller responses retain notes/userNotes keys used by the paired frontend.

## Checks and limitations
npm test; npm run test:integration (temporary real local MongoDB with synthetic fixtures); npm run lint (syntax checks). No compile/typecheck is applicable to plain JS. See docs/VERIFICATION.md for mock versus live scope. Local cookie/CSRF and real Mongo CRUD/reconnect/concurrent cap tests are implemented. Browser/hosted authentication, username index review, dependency remediation, bounded legacy reads, pagination, rate limiting and a deployment preview remain; no security-complete release claim. Back up existing data before any future migration. No AI integration or live demo is claimed in this slice.

## Continuity
BACKLOG.md, UPGRADE_LOG.md and docs/DECISIONS.md record acceptance criteria and trade-offs. docs/automation contains a reproducible daily runner; the configured local scheduler uses the owner's persistent outputs copy. It makes PRs on upgrade branches and never auto-merges or updates production. See that directory for manual/pause controls and the desktop availability constraint.

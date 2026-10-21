# Local authentication and deployment contract

The paired upgrade/notes-v1 branches must be released together. Existing note endpoints and response keys remain; logout changes from GET to POST. GET logout returns 405 without clearing a session. Login/register/logout and note mutations require an exact allowed Origin and X-Notes-Request: 1. This is an Origin + non-simple-header CSRF boundary; do not allow wildcard origins or disable the header gate. Non-browser test clients must supply the same headers deliberately.

## Local setup

1. Use Node 22.12+ on the Node 22 line, or Node 24+, and npm ci in both repositories.
2. Backend: copy .env.example to ignored .env and generate two independent random values of at least 32 characters for JWT_SECRET and COOKIE_SECRET. Use only a new local synthetic database. Never copy existing hosted credentials here. FRONTEND_ORIGINS defaults to http://localhost:3000 outside production; configure it explicitly when using another frontend port. PORT defaults to 4040. Run npm start with a running local MongoDB.
3. Frontend: copy .env.example to ignored .env.local for the separate local API at http://localhost:4040/notepad, then npm start. With no override it uses /notepad on the current origin, which requires a reverse proxy. REACT_APP_API_URL is public build configuration, never a secret. Restart/rebuild after changing it. Requests include cookies, the write header and a 15-second timeout.
4. Register a synthetic account, create/edit a note, reload /notes, log out, then log in and delete the synthetic note. Session checking must finish before redirecting or fetching notes. Server errors offer a retry; an actual 401 means signed out.

## Independent database integration

npm test runs HTTP/configuration/startup and mocked note-service/JWT regression tests. npm run test:integration launches a real temporary local mongod through mongodb-memory-server (dev dependency), exercises signed cookies and persistence with synthetic accounts, then stops it. It does not read MONGODB_URL from an existing hosting service or touch Atlas. First execution can download an official MongoDB binary; offline environments must provide the supported binary cache. Existing API CI now runs this integration command, with its original triggers unchanged. No daily engineering trigger was added.

## Preview configuration and release gate

No preview has been deployed. Backend requires MONGODB_URL and independently configured secrets in the existing approved hosting environment, NODE_ENV=production, explicit HTTPS FRONTEND_ORIGINS and PORT from the host. Cookies are HttpOnly, signed and host-only with a shared issue/clear scope. SameSite=Lax is the default for same-site hosting. Separate cross-site HTTPS hosts require explicit COOKIE_SAME_SITE=none; third-party cookie blocking can still prevent that arrangement. Prefer a same-origin proxy when choosing a preview. Do not change domains or production automatically.

GET /health returns 200 only when Mongoose is connected, otherwise 503, with no connection details. Startup refuses missing/weak configuration and exits on database failure without logging the URI or credentials. SIGINT/SIGTERM stop accepting connections and close MongoDB, with a ten-second hard deadline. Signal-driven graceful shutdown is implemented but not process-signal verified on Windows in this run.

Before preview: browser-check desktop/mobile register/login/create/edit/reload/logout with real local persistence; resolve dependency findings, add authentication abuse controls and assess the original username uniqueness typo (unqiue) and duplicate-account/index risk. autoIndex is disabled to avoid creating indexes against legacy data automatically; no migration or uniqueness guarantee is claimed. Then explicitly provision/configure a dedicated approved synthetic preview database; keep any live secrets in hosting. Hosted Atlas/HTTPS cookies are not yet verified.

Rollback: stop the preview and restore the previous paired frontend/backend revisions together. The older frontend uses GET logout and cannot use the new write gate, so mixed releases are unsupported. Embedded note IDs and data shape are unchanged; no destructive migration, original-record edits or production replacement occurred. Stateless logout clears the browser cookie; previously copied JWTs are valid until expiry, so session revocation is not claimed.

## October 14 toolchain contract

Frontend now uses Vite with the same public REACT_APP_API_URL, port 3000 and build/ output; compiled modules are in assets/. Standalone Jest preserves all 18 behavior tests. Dev/build/preview configuration, public assets and SPA fallback have synthetic HTTP checks. See the frontend docs/TOOLCHAIN.md for modern browser targets, exact setting exposure and rollback. Netlify SPA fallback is declared; place an approved same-origin /notepad proxy before it. Backend API, cookie/Origin/header contract and deployment order are unchanged. No deployment or hosted verification. Browser desktop/mobile authentication/CRUD/cookie/throttling remains unverified.


## October 17 test-tool update

Frontend tests now use Vitest 5.0.5/jsdom 28.1.0 with all 30 existing cases retained; run npm test without Jest CLI flags. Fresh frontend full/runtime audits are zero; unsupported ESLint 9 remains. This changes no paired API/cookie/deployment contract. Synthetic checks do not establish hosted or browser behavior; existing preview/index/proxy gates still apply.


## October 20 create retry contract

POST /notepad/notes/newNote optionally accepts createKey: epoch-milliseconds.UUID-v4 alongside title/content. Use one exact key and normalized title/content for all retries of one create. Matching replay returns 201 and the current notes array; a different draft with that key returns 409. The owner-scoped receipt persists atomically with the note and survives edit/delete. Keys expire 24 hours after their timestamp; timestamps over 60 seconds in the future also reject with 400 CREATE_RETRY_EXPIRED. Expired keys cannot become new creates after pruning. At 1000 unexpired receipts new keyed creates return 429, without evicting a live receipt. Existing note limit remains 200; accepted replays still work at either cap. Responses omit receipt data. Server clocks must be correct.

Deploy the backward-compatible API first, then the keyed frontend. Legacy callers without keys still work but have no retry protection. Capture keeps its key and draft only in mounted memory; after uncertain failure keep the page open and retry the same save. Fields remain selectable/read-only for copying. A later authentication failure cannot reset an uncertain attempt. Reload/navigation or an expired key requires checking the library before starting a new note; protection across reload and edit/delete revision conflicts is not claimed. Do not automatically replay against the old API or erase receipts during the 24-hour window. No live migration or hosting operation is part of this change.


## October 21 conditional revision contract

Notes expose revision (zero for legacy notes without a stored field). PATCH /notepad/notes/updateNote accepts expectedRevision with content/noteID; DELETE /notepad/notes/deleteNote/:noteID accepts a JSON body containing expectedRevision. Revisions must be nonnegative safe integers below Number.MAX_SAFE_INTEGER. Match owner, note ID and revision atomically in one array element; successful edits increment revision. A stale owned note returns 409 NOTE_CONFLICT without note contents; a missing/foreign note returns 404. Legacy callers may omit expectedRevision and remain unconditional, but edits still increment revision. Only conditional clients have stale-write protection. Missing legacy fields are initialized on the next edit, with no bulk migration/index operation.

Deploy the compatible API before the revision-aware UI. UI pins the editor's original revision, never silently rebases/retries a conflict, and keeps its draft read-only/selectable with copy/close/reload guidance. A stale delete retains the displayed library and offers recovery guidance. Copy all unsaved drafts before reload; capture retry keys remain mounted-memory only. An uncertain successful edit may conflict on retry: check persisted notes after copying rather than overwriting blindly. Roll UI back first if needed; retain stored revision fields, note IDs and create receipts. Browser XHR DELETE-body/proxy acceptance, desktop/mobile draft-copy/keyboard and actual hosted deployment remain unverified; Axios Node HTTP serialization and real local synthetic Mongo concurrency are independent checks.

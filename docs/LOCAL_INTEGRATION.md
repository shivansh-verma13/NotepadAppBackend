# Local authentication and deployment contract

The paired upgrade/notes-v1 branches must be released together. Existing note endpoints and response keys remain; logout changes from GET to POST. GET logout returns 405 without clearing a session. Login/register/logout and note mutations require an exact allowed Origin and X-Notes-Request: 1. This is an Origin + non-simple-header CSRF boundary; do not allow wildcard origins or disable the header gate. Non-browser test clients must supply the same headers deliberately.

## Local setup

1. Use Node 22+ and npm ci in both repositories.
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

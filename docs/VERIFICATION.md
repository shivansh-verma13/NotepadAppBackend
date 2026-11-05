# Verification — first Notes slice

npm ci passed (163 packages). npm test passed: six Node tests. npm run lint passed: syntax checks for app, note service and token middleware. JavaScript has no typecheck/transpile step; no nonexistent build command is claimed.

Tests cover blank/oversized/object payload rejection; atomic push and database-enforced count predicate; owner-and-note-scoped edit/delete with non-enumerating missing-note response; invalid IDs before DB access; internal error redaction; valid/expired/tampered JWT behavior. Model calls use a fake adapter and query assertions. This verifies controller contracts, not real MongoDB concurrency or persistence. Real Atlas tests are pending a separate Notes database and credential configuration. Existing user cookie domain and connection startup behavior remain blockers for live integration. No provider calls or production records were used.

## Authenticated local integration slice — October 5, 2026
Backend: final locked npm ci passed (199 packages), expanded syntax lint passed, nine tests passed plus one real local MongoDB integration. Unit coverage includes six original mocked note-service/JWT tests; new HTTP tests use real Express/cookie-parser/CORS without a database for validation/boundary cases. Startup child-process checks fail closed for missing configuration and unavailable synthetic database and assert redacted logs. Real Mongo integration uses temporary mongod (mongodb-memory-server 10.x), independent randomly generated local signing secrets and two synthetic accounts. Signed-cookie login/register/auth, owner-only CRUD, edit persistence across reconnect, logout-cookie expiration, health 200/503 and two competing creates at 199 notes (one 201/one 409, total 200) passed. No live Atlas, hosted secrets, original records or providers were used. SIGTERM/SIGINT graceful shutdown remains unverified at process-signal level on Windows. No JS typecheck/backend compile applies.

Frontend: locked npm ci passed (1,552 packages); expanded lint passed with zero lint warnings; eleven tests across five suites passed (mocked API/context/router in UI tests); production build passed at 150.30 kB main JS gzip. Covers delayed auth restore, 401 versus retryable service error, stale restore versus login, local logout state, notes not fetched/redirected before auth, duplicate sign-in submits/failure retention and prior draft/edit regressions. Initial test harness failed accessibility lint and Jest hoisting; corrected and reran all tests/build successfully. This does not verify a real browser.

Browser tool returned empty inventory; Chrome and in-app browser were unavailable. No new screenshot or visual success claim. Desktop/mobile register/login/create/edit/reload/logout against real local MongoDB, auth layout, cookie acceptance and CORS behavior remain unverified in the browser; prior first-slice screenshots are historical synthetic API checks. Hosted HTTPS/Atlas verification and deployment remain pending. Production unchanged.

npm reports backend 16 dependency findings (4 low/1 moderate/9 high/2 critical), frontend 72 (15 low/18 moderate/35 high/4 critical). No audit remediation or clean security claim. Existing CRA preset/Browserslist and Node deprecation warnings remain. See docs/LOCAL_INTEGRATION.md for setup/deployment gates and UPGRADE_LOG.md for paired PR/commit review links.

Local checks ran on Node 24.14.0 / npm 11.12.0. Existing GitHub CI uses Node 22; post-push CI status is recorded in the isolated run checkpoint and PR body.

## October 7, 2026 — account abuse slice
Locked installs and final lint/tests/build passed. Backend: 12 tests (six original mocked service/JWT tests plus real HTTP/configuration/startup checks and three limiter tests); temporary real MongoDB synthetic integration passed. Frontend: 13 mocked component/context tests in five suites and production build, 150.46 kB main gzip. No typecheck or backend compile script exists. All final checks passed; initial npm launcher/cache/network restrictions and sandbox startup timeout were recovered with bundled npm, checkout-local cache and approved execution. Browser inventory/Chrome/in-app unavailable; throttled account retries and desktop/mobile authenticated CRUD remain unverified. Hosted database/providers were not used. Audit findings: backend 17, including 9 high/3 critical; frontend 106, including 37 high/5 critical. CRA/Babel/Browserslist/Node warnings remain. See UPGRADE_LOG.md for source commits, PRs, blockers and deployment status; docs/AUTH_ABUSE_AND_INDEX.md for process-local limiter limits and manual index rollout.

## October 11, 2026 — username uniqueness rehearsal
Locked installs passed. Backend expanded syntax lint, 13 unit/HTTP/startup tests
and one temporary real MongoDB synthetic integration passed. The first startup
test hit its unchanged 12-second deadline; isolated and full reruns passed.
Frontend lint and 14 mocked tests across five suites passed. Build and post-push
CI status are recorded in the run checkpoint and PR bodies. No typecheck/backend
compile script exists. Index/race/duplicate-preservation checks use real local
MongoDB; only the precheck race scheduling barrier is mocked. No hosted database,
provider, production secrets or original records were used. autoIndex=false and
no automatic live index operation. Browser inventory empty, Chrome/in-app
unavailable: desktop/mobile conflict/retry/CRUD and cookie/throttle flows remain
unverified. Audits unchanged: backend 17 (3 critical), frontend 106 (5 critical).
Frontend production build passed: 150.51 kB main JS gzip; existing CRA/Babel/Browserslist/Node warnings remain.

## October 11, 2026 — backend patched dependency verification
Fresh npm ci passed (151 packages), npm run lint passed, npm test passed (13), npm run test:integration passed (1 real temporary local MongoDB), npm audit --audit-level=low passed with zero findings. Windows Node 24.14.0/npm 11.9.0; Node-22 CI awaits push. No backend build/typecheck applies. Integration seeds a synthetic $2b$ cost-10 hash generated by the published bcrypt 5.1.1 Windows N-API binary (upstream release); bcrypt 6 successfully logs in/authenticates, rejects a wrong password without a cookie and leaves the stored hash unchanged. Existing real index/race/duplicate-preservation/owner-CRUD/reconnect/cap cases passed; race barrier/service unit adapters remain mocks. No live records, hosting or provider used. Frontend checks/browser journey were not rerun: no frontend runtime change; prior 106 dependency findings and browser blockers remain open. See UPGRADE_LOG.md and docs/DECISIONS.md for exact versions, source link, release gates and reversal conditions.

Post-push verification: existing Node-22 CI passed on backend 03c724b (https://github.com/shivansh-verma13/NotepadAppBackend/actions/runs/38138900248) and frontend 91b8751 (https://github.com/shivansh-verma13/MERN-NotePadApp-Frontend/actions/runs/38138902407); push and PR runs succeeded for both. Backend install/lint/tests/real synthetic Mongo integration and frontend install/lint/tests/production build passed in CI. Frontend checks therefore have a current CI result, although they were not rerun locally. Browser/live hosting remain unverified. This final documentation-only update records those tested heads; latest documentation-head CI is tracked in the retained run checkpoint/PR bodies. No engineering automation or deployment was manually triggered.

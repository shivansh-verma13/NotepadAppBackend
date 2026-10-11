# Account abuse controls and username index rollout

Login and registration share 20 attempts per socket IP per fixed 15-minute window,
including successful and invalid requests. The limiter runs after the origin/header
boundary and CORS, before JSON parsing, validation, database lookup or bcrypt. It
returns 429 with a positive Retry-After in seconds; CORS exposes that header. The
frontend retains fields and explains when to retry. Logout, session restoration,
notes and preflight do not consume this budget.

Each app instance stores at most 10,000 hashed address keys in memory. Expired keys
are reclaimed at capacity; active entries are never evicted to admit another IP.
At capacity new addresses receive 429 until the earliest expiry. No address,
username, password or request body is logged by this limiter. Hashes are not an
anonymization guarantee. State disappears on restart and is not shared across
workers. This is a bounded single-process guard, not distributed DDoS protection.

Express retains its default trust proxy=false. X-Forwarded-For cannot select a
budget. Behind an unconfigured proxy every user shares its socket IP budget: do
not preview in that configuration. Before hosted release, verify the actual proxy
chain and either change address selection to verified proxy-derived IPs with
narrowly trusted proxy hops and spoofing tests, or use a shared
edge/store-backed limiter. Never set trust proxy=true indiscriminately. NAT users
share a budget and fixed windows allow a boundary burst. Success does not reset
the budget; an account-name limit was avoided because it enables remote account
lockout. Revisit after measuring legitimate traffic without logging credentials.

## Recoverable username uniqueness rollout (manual; not executed)

The legacy schema's `unqiue` typo has been replaced by named index metadata:
`username_unique` on `{ username: 1 }`, unique with exact case semantics. The API
maps only that username duplicate-key pattern to a redacted 409 without issuing
a session. autoIndex remains false; startup does not build indexes. No live index,
account merge or record cleanup was performed. Live uniqueness remains a release
blocker until the manual audit/backup/build gates below pass.

1. In an approved non-production copy, inspect actual indexes and audit username
   types, missing values and exact duplicate counts. Use a read-only aggregation
   grouped on username with a bounded output limit; restrict the detailed report
   to the existing database environment. Do not paste usernames, notes or access
   details into logs, PRs or this checkout. Record only aggregate counts.
2. Take and verify an approved recoverable backup before any live index operation.
   Rehearse restore and the rollout on synthetic data (including duplicates).
   Preserve exact case-sensitive usernames; normalization is a separate decision.
3. If duplicates/malformed records exist, stop. Have the owner approve an account
   recovery plan that preserves ownership and embedded notes. Never automatically
   choose a winning account, merge credentials or discard data.
4. Add a named explicit unique username index and handle duplicate-key failures
   as 409 in the API, retaining autoIndex=false. In the synthetic rehearsal test
   two concurrent registrations: exactly one 201 and one 409, one account, no
   password/hash leakage. Verify existing login and owner-scoped CRUD afterward.
5. For an approved rollout, pause registration during the final duplicate audit
   and explicit index build. Keep login/notes available if hosting supports it.
   Deploy duplicate-key handling before reopening registration. Inspect index
   metadata and repeat the concurrent synthetic username check in preview.
6. If the build fails, keep registration paused, preserve the checkpoint and
   backup, and investigate. Do not drop unrelated indexes or retry with destructive
   cleanup. If API rollback is needed, keep a successful unique index; older code
   may return 500 on a registration race but must not reopen duplicates. Removing
   the unique index requires a separate owner-approved rollback plan.

Deployment order: ship the frontend retry explanation, then the API limiter in
the paired preview, after proxy verification. Old frontend clients still receive
an error but show a generic retry prompt. Existing POST/header/cookie contracts
remain required. No hosted deployment or live database verification is claimed.


## Disposable rehearsal — October 11, 2026
Locked backend integration uses a fresh temporary mongod with synthetic records
and random local signing secrets. It verifies no automatic username index exists,
then explicitly builds `username_unique` on the disposable user collection. A
separate duplicate fixture rejects the same unique build (11000) and both full
records/notes remain intact. Both registration prechecks are held at a test-only
barrier before save: exactly one 201, one redacted 409, one stored account, no
cookie on failure, then successful login/auth and the existing owner-only
CRUD/reconnect/cap journey. The lookup barrier is a mock used only to schedule the
race; writes, index enforcement, HTTP, bcrypt and persistence use real local Mongo.
No live database or approved hosting credentials were used.

For an owner-approved rollout only, after the preceding audit/backup/pause gates,
the explicit driver operation is:
`UserModel.collection.createIndex({ username: 1 }, { unique: true, name: "username_unique" })`.
Do not call syncIndexes/createIndexes at startup or use automatic duplicate cleanup.
The test does not authorize executing this against legacy or hosted data. Deploy
the 409 API handling before building the index/reopening registration; paired UI
explains the conflict and lets the user correct the username without losing fields.

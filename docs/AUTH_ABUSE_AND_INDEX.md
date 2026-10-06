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

The legacy schema's `unqiue` typo provides no uniqueness enforcement. The current
find-before-save registration check can race. autoIndex remains false; this slice
does not declare/build an index, merge accounts, delete records or change username
case semantics. Registration uniqueness remains a release blocker.

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

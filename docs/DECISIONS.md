# Decisions

## Notes slice 1: refactor the save boundary
Proposal: retain React 18/MUI and Express/Mongoose, keep endpoint and response contracts, replace whole-user read/mutate/save with owner-scoped atomic Mongo operators and preserve failed UI drafts.
Challenge: a Vite/TypeScript rebuild would simplify the aging CRA toolchain, but it delays fixing data loss and mixes API migration with UI replacement. A separate notes collection supports pagination better but requires an explicit data migration.
Decision: focused refactor now. Verify save/failure semantics first; revisit Vite after the authenticated journey works. Reverse this choice when CRA blocks build/test or the redesigned UI needs clean entrypoints. Introduce a dedicated notes collection only after measured query needs and a recoverable migration plan.

## Scheduling
Proposal: use the available desktop scheduled task, invoking the installed ChatGPT-authenticated Codex CLI in isolated checkouts.
Challenge: GitHub Actions plus the official Codex integration is always-on but requires API credentials/credits absent in this account; Windows has no cron daemon. A custom Windows Task Scheduler service would add installation/access beyond the existing scheduler.
Decision: supported desktop automation plus a reusable bounded CLI wrapper. Verified GitHub identity and CLI login; no new token or billing. Desktop app/computer availability is a limitation, and runs can be delayed. Switch to a cloud runner when an API budget and repository-scoped credentials are supplied. Manual wrapper works independently of this chat. The app scheduler is the only recurring trigger; no push trigger can recursively launch it.

Access: existing authenticated gh/git session, no additional repository access granted. The application allowlist restricts eligible changes; the existing session itself may have broader account permissions. For credential-level isolation use a fine-grained GitHub token limited to the active two repos with Contents and Pull requests read/write plus Metadata read, stored in the OS credential manager, never in these files. Do not silently claim the existing account login is a repository-scoped token.

## Notes slice 2: authenticated local integration
Proposal: keep signed host-only JWT cookies; configure exact frontend origins, require an allowed Origin plus X-Notes-Request: 1 for every mutation (including login/register/logout), use POST logout, and default to SameSite=Lax. Configure Secure production cookies; cross-site SameSite=None is an explicit HTTPS-only option. Test with a temporary real local MongoDB and synthetic accounts.
Challenge: a synchronizer CSRF token also protects cookie sessions but needs a token lifecycle/bootstrap endpoint. Bearer tokens avoid cookie CSRF but require a new storage/refresh model and increase exposure to script access. Exact-origin plus a non-simple header fits the existing browser-only API, rejects forms and requires CORS preflight; it depends on an exact trusted-origin allowlist.
Decision: cookie plus Origin/header gate for this bounded release, with host-only scope and shared issue/clear options. No wildcard origins or GET mutations. Validate configuration before startup and stop on database failure. Revisit synchronizer tokens if non-browser clients or proxy deployments cannot preserve Origin, or if trusted-origin boundaries change. Do not loosen origin checks to accommodate a deployment. Backend contract must ship with the paired frontend before any preview; production remains unchanged.

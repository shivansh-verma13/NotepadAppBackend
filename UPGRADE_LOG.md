# Upgrade log

## October 5, 2026 — reliable note save slice
Selected Notes after Interview Lab's release. Preserved original repositories, stack and API response keys; upgrade/notes-v1 branches isolate changes from production/default history. Fixes implemented: retain draft on failed create/update, guard duplicate submission, accessible labels/pending state, confirm deletion, stable note IDs; owner-scoped atomic push/set/pull, bounded input/new-note cap, deterministic invalid JWT rejection and generic errors. No database records modified and no production deployment replaced.

Verification: see docs/VERIFICATION.md. Database tests use a fake model; real Atlas execution and hosted auth are not yet verified. Existing cookie domain=netlify.app is incompatible with local/other hosts and is the next blocker. No AI feature is claimed in this slice. The existing CRA toolchain is deprecated; capture baseline warnings and do not conceal them.

Next task: fix cookie/environment/exact-origin and CSRF design, run the authenticated CRUD journey against a dedicated synthetic database, then redesign the notes workspace. Add grounded summaries only after source authorization works.

Checkpoint: paired PRs https://github.com/shivansh-verma13/MERN-NotePadApp-Frontend/pull/1 ; https://github.com/shivansh-verma13/NotepadAppBackend/pull/1. Initial substantive commits: frontend d6bcfb9; backend 9fd5730. Local checks and synthetic browser save/retry/edit passed; frontend branch CI and backend CI passed. Desktop scheduled task daily-project-modernization is ACTIVE for 8:00 AM Asia/Kolkata. Its CLI read-only isolated-checkout trial and overlap skip passed. Production is unchanged. Next task remains authentication/configuration/CSRF and real Mongo integration.

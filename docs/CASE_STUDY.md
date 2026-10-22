# Notes: making saves reliable

## Original problem
The React editor cleared a draft immediately after starting a request, and its edit dialog closed even when the update failed. The Express API loaded a whole user document, changed an embedded array and saved it, risking overwrites between unrelated concurrent note mutations. Fixed desktop offsets placed the composer outside the mobile viewport.

## Implemented slice
Preserve failed drafts, disable/guard duplicate submissions, close edit only after success, add accessible labels and safe errors, confirm deletion, render stable note IDs and use a bounded mobile/desktop workspace. Keep the original API contracts and embedded IDs; use owner-scoped atomic Mongo push/set/pull and validate text/IDs. Invalid and expired JWT cookies now reject deterministically. A 200-note creation cap bounds new growth; old data is not deleted or migrated.

## Decisions and evidence
Refactor existing React/MUI and Express/Mongoose rather than immediately rebuild toolchains or migrate storage. That fixes the save journey with fewer moving parts. Revisit Vite when CRA blocks delivery; revisit separate note storage when pagination/query evidence justifies a recoverable migration.

Four frontend component tests and six backend tests passed. Lint for changed frontend files, backend syntax checks and frontend production build passed. GitHub CI is green in both PRs. Actual browser testing with a synthetic HTTP API verified failure/retry/edit/reload at desktop 1280px and mobile 375px; the initial mobile overflow was corrected. No live Mongo persistence/concurrency, hosted auth, scale, AI behavior, users or business impact is claimed.

## Limits and next task
This slice is in review, not deployed. Next: cookie/environment/exact-origin and CSRF protections, dedicated synthetic Mongo CRUD integration, then a distinctive searchable workspace and one opt-in grounded note-summary feature. CRA dependency warnings remain. No destructive migration, paid resources, default-branch merge or production replacement was performed.

## Portfolio-ready copy for the completed slice
Improved a paired React/Express notes application with failure-safe drafts, accessible pending/error states and responsive capture. Replaced whole-document note writes with validated owner-scoped atomic mutations, with regression tests for save failures and invalid sessions. The larger Notes release remains in development.

PRs: https://github.com/shivansh-verma13/MERN-NotePadApp-Frontend/pull/1 and https://github.com/shivansh-verma13/NotepadAppBackend/pull/1 .

# Modernization backlog — October 5, 2026

Inventory refreshed through authenticated GitHub CLI: 43 repositories, including private repos. Fifteen candidate source trees were previously inspected; Notes was audited again for this release. The original app pairs and API paths confirm the map below. Names alone are not ownership evidence. No private repository was selected.

| Priority | Product / repositories | State and value | Next bounded release / AI | Scope and hosting |
|---|---|---|---|---|
| Released | Interview Lab: MERN-gpt + MERN-gpt-Backend | Live Gemini practice, private saved reviews, text/audio/video | Maintain failures/quotas; physical-device verification pending | Existing React/Express/MongoDB, Netlify/Render |
| 1 active | Notes: MERN-NotePadApp-Frontend + NotepadAppBackend | CRUD app; drafts lost on failed save, whole-array writes, invalid cross-host cookies | Reliable private capture/edit/search, then opt-in source-backed note summary | Refactor React/Express/MongoDB; new preview only after auth/integration passes |
| 2 | VideoMeet: Video-Meet + VideoMeetBackend | WebRTC app, global disconnect/reconnect weaknesses | Stable two-person calls, consent-based transcript/action items | Refactor; WebSocket host, TURN and transcription credentials needed |
| 3 | Chat: MERN-ChatApp-FrontEnd + MERN-ChatApp-Backend | Real-time messaging, delivery/ownership audit needed | Verified delivery/reconnect, opt-in drafting | Refactor; persistent WebSockets/MongoDB |
| 4 | Recipes: RecipeBlogApp + RecipeBlogApp-FrontEnd | CRUD API with newer React UI; RecipeBlogFrontEnd is older duplicate | Ingredient discovery, validated suggestions with explicit provenance | Refactor; Node/MongoDB/provider |
| 5 | Jobs-Hai | Vue/json-server prototype | Application tracker and explainable job matching | Rebuild API, preserve useful UI; persistent database |
| 6 | WeatherAct | Express/static weather app | Forecast-grounded activity planning | Focused refactor, weather API key |
| Maintain | Portfolio | Deployed V2 | Showcase only verified releases | Existing Vite/Netlify |

## Exclusions
Assignments: Clinikally-assignment, finacPlus-assignment, SuperHumanRace, excluded private repository, excluded private repository. Employer/client or unclear scope: PgVala, PgValaBeta, DashBoardSB, opt-alpha, Shivansh-Verma-Harji-Softech-Frontend, excluded private repository, excluded private repository. Starters/practice: starter-express-api (fork), React-Hooks-Code, RegressionAnalysis, SimonGame, DrumSet, OlympusReplica, TinDog-TinderForDogs, excluded private repository, excluded private repository, excluded private repository, excluded private repository, excluded private repository. Inactive portfolio duplicates: PortfolioWebsite-v1/v2. ai-companion needs original-work/third-party starter provenance and external-service review. ToDo-List has a previously found exposed database credential; do not automate until the owner rotates it and scope is reviewed. Personal profile repo excluded from engineering churn.

## Active Notes acceptance criteria
1. Draft survives failed create/update; pending submit disabled; title/content bounds match server.
2. Owner-scoped atomic mutations and deterministic invalid-token behavior, tested.
3. Correct local/same-origin authentication, CSRF/exact-origin write checks, environment configuration, health/graceful shutdown; real Mongo integration with synthetic fixtures.
4. Polished responsive notes workspace, accessible capture/edit/delete with loading/error/empty/search states, browser checks on mobile and desktop.
5. One opt-in note-summary feature with owner-only selected sources, citations, structured output validation, failure/timeout/cancellation handling, quotas and mock evaluation set. Live provider verification separate.
6. Preview deployment, persisted create/edit/reload journey, rollback/setup documentation and actual screenshot/case study. No production overwrite or paid service automatically.

Only items 1–2 are this first slice. Next task: authentication/configuration and real database integration. Keep the product active until all release criteria pass; do not start a second reconstruction. Existing embedded notes stay recoverable; no destructive schema migration is authorized. Existing accounts above 200 notes remain readable/editable/deletable but cannot add until under the cap. Pagination/versioned dedicated-note storage are later choices requiring evidence.

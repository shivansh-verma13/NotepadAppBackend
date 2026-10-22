# Daily project modernization

The supported desktop scheduled task Daily project modernization is active for 8:00 AM Asia/Kolkata daily. The computer must be awake with the app running; this chat can be closed. Scheduling may be delayed by platform load, unavailable machine or account usage limits. No always-on cloud execution is claimed. The task invokes this wrapper to perform actual engineering, not a reminder.

Manual: run pwsh -File Run-Modernization.ps1 from this directory (or its absolute path). Use -CheckOnly for prerequisite/lock verification; -SmokeTest for an authenticated read-only CLI trial. Scheduled view also supports Run now. Pause there or set paused=true in progress.json; resume by reverting it. No push event triggers another engineering run.

Each run obtains an exclusive OS file lock, clones both active repositories into a unique runs directory, validates GitHub login, sets repository-local verified identity and executes Codex with approval review/sandbox enabled. All subprocesses share a 45-minute limit; timeout terminates the process tree. No raw tool output is logged. result.json records safe exit metadata, summary.md records the agent's safe report, and repository upgrade logs provide durable continuation. Failed checkouts remain for recovery; no automated deletion or force push. Review and remove recoverable stale checkouts manually when no longer useful.

Current GitHub author: Shivansh Verma, 115868006+shivansh-verma13@users.noreply.github.com, derived from verified account ID 115868006. Dedicated upgrade branches and PRs are used; no automatic merge. Meaningful verified work should produce a commit on successful days; blocked/skipped days produce an honest result. Feature-branch commits may not appear in the contribution graph until merged into an eligible default branch.

Current credentials use existing Codex ChatGPT authentication and OS gh/git authentication, no API key in prompts/source/logs. Actual token-level access is not narrowed by a policy file; see DECISIONS.md for least-privilege fine-grained credentials. Approvals can block unattended network or other actions; report those instead of bypassing them. Secrets for live projects stay in their existing approved hosting environments. No secrets are copied to run checkouts. See BACKLOG.md and workflow.md for release criteria and exclusions.

Windows PowerShell 5.1 execution policy blocks local scripts on this computer. Use the installed PowerShell 7 (pwsh), which passed prerequisite and lock checks; do not disable execution policy.

Verification: scheduler created and re-read as ACTIVE, Windows timezone India Standard Time (+05:30), prerequisite checks passed, second-run exclusive-lock skip passed, and authenticated noninteractive read-only Codex execution passed (53 seconds). Both repositories were cloned to an isolated run directory. No unattended engineering delivery or elapsed 45-minute timeout test is claimed; the termination path is implemented. First engineering slice was implemented and checked interactively, then pushed as two substantive commits. Run summaries do not include raw tool output.

PRs: https://github.com/shivansh-verma13/MERN-NotePadApp-Frontend/pull/1 and https://github.com/shivansh-verma13/NotepadAppBackend/pull/1 .

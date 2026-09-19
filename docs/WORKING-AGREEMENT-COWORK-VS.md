# Working Agreement — Cowork Claude and Claude Code (VS)

Two Claudes, one repo, no copy-paste relay through Chris. Written 2026-09-18 by the Cowork side.

## Who does what

**Cowork Claude** (Claude app, linked to this machine, mounts this folder read/write)
- Decisions and judgment: pricing, tiers, what a claim is allowed to say, risk calls
- Writes and maintains briefs and status docs under `docs/`
- Read-only inspection of code to check whether a claim is true
- **Does not edit code. Does not run git write commands. Does not commit.**
- **Hands every repo or terminal action to VS as a paste-ready instruction** — never as commands
  for Chris to run himself. See "Cowork does not hand Chris commands" below.

**Claude Code / VS** (terminal, this machine)
- All code changes, tests, `npx tsc --noEmit`, verification scripts, git, commits, branches
- Updates the status doc after each commit
- Raises anything that looks like a product or truthfulness decision instead of deciding it

**Chris** decides. Neither Claude flips a switch, ships a claim, or spends money without his yes.

## Why Cowork does not touch git here

The folder is mounted into a Linux VM. The worktree is CRLF, the index is LF, so `git status`
from the Cowork side reports ~256 files and ~61,000 changed lines that are not real. On Windows
the tree is clean. **Do not "fix" this with a `.gitattributes` or `core.autocrlf` change just to
quiet the Cowork view** — it would rewrite line endings across the repo for no benefit. The fix
is the rule above: commits happen from Windows only.

If Cowork ever does edit a file here, it preserves CRLF endings.

## Cowork does not hand Chris commands

Added 2026-09-18 at Chris's instruction. When Cowork's work produces something that has to happen
in the repo or a terminal — a commit, a push, a script run, a verification command — Cowork does
**not** write it up as PowerShell for Chris to execute. It writes a self-contained instruction
addressed to VS, which Chris pastes across. The instruction states what to do, what **not** to
touch, and enough of the reasoning that VS can tell a real change from the CRLF noise.

This is for accuracy and efficiency, not ceremony: VS is already in the terminal with the repo
state in front of it, and a hand-copied command is a place for a typo to enter.

**What cannot be delegated to VS**, and stays with Chris:
- Anything physical or on the phone (the Northside transfer test call)
- Anything behind a vendor account or that spends money (the Retell auto-recharge setting, Stripe,
  plan upgrades on Supabase or Vercel)
- Anything requiring his authority or his lawyer (the Resend/BAA question, signing anything)

Cowork names these as Chris's own actions and does not bury them inside a VS block.

## Handoff happens in files, not chat

- **`docs/pre-stripe-status-2026-09-18.md`** — the live state of the current effort.
  Cowork writes the priorities and the decisions; VS updates status after each commit.
- **`docs/vs-claude-handoff-tier-fixes.md`** — the spec for that effort.
- VS's written reports (scoping, audits, "SCOPE ONLY" answers) go into the status doc under a
  `## Reports` heading, or into a new `docs/` file named in the brief.
- When a session ends with open items, the existing protocol still governs: update the handoff
  section at the top of `CLAUDE.md`.

## Model policy

**VS: Sonnet by default.** Escalate to Opus when:
- a bug survived two attempted fixes
- the change spans more than ~5 files, or touches provisioning, billing, booking or Retell config
- a new subsystem is being designed
- being wrong costs real money, a real number, or a real customer

**Cowork: Sonnet for coordination and docs.** Opus for:
- pricing and tier decisions
- truthfulness, compliance and legal-adjacent judgment
- reviewing a plan before a large build starts
- post-mortems on anything that went wrong

When handing work across, say which model produced it if a wrong answer would ship.

## House rules both sides keep

- Chris runs **PowerShell**. Never hand him bash syntax or angle-bracket placeholders.
- **No deadlines.** Order work by dependency, then risk to a real person, then truthfulness debt.
- **Copy and capability ship together.** No claim goes live ahead of the feature.
- System and test emails go to `chris@369agenticsystems.com`, never the gmail address.
- Re-derive facts from the live system, never from a doc's previous version. A quoted command is
  a claim; run it.

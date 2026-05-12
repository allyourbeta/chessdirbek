# Going Public

Notes on what to do before making Chessdirbek a publicly shared GitHub project.

This doc separates *what actually matters* from *what's online-checklist theater*, and ends with a suggested order of operations specific to Chessdirbek.

---

## Should PWA work happen first? Yes.

PWA before public release is the right call:

1. **PWA work touches files that affect everyone** — `manifest.json`, service worker (`sw.js`), icon assets, install prompts, offline behavior. Doing it after release means your first wave of users sees a non-PWA version and a later "now it's a PWA!" change feels like churn. Doing it before means v1.0 is already the polished thing.
2. **The PWA story is a feature you'd advertise in the README.** "Installable on desktop and mobile, works offline" is exactly the kind of bullet that gets people to click. If the README promises it, it should be true on day one.

Reality check: Chessdirbek already has *some* PWA scaffolding — `manifest.json`, icons, a 23-line service worker, and the manifest is linked in `index.html`. So this is a refinement, not a build-from-zero. What's likely missing:

- Service worker *registration* in JS
- Proper offline caching strategy (which assets to cache, how to handle API calls offline)
- An install prompt UX

Scope it as its own focused session.

---

## Sharing on GitHub — what actually matters

### Truly important — do these before the repo goes public

**A README that respects strangers' time.** This is by far the most important asset. A stranger landing on the repo decides in about 15 seconds whether to keep reading. Structure that works:

- One-sentence description in the first line. Example: *"Chessdirbek is a self-hosted chess position trainer with tagging, Stockfish analysis, and per-position practice tracking."*
- A screenshot or animated GIF — *immediately*, before anything else. People will skim past 500 words to see what the app looks like.
- A short, scannable Features list — no marketing fluff.
- A Quick Start that actually works: ~5 commands max, copy-pasteable, that get the app running locally. If it requires more, simplify the path.
- Tech stack section — devs want to know what they're getting into before they `git clone`.
- A Status / Project Goals paragraph. Is this maintained? Production-ready? A personal hobby? Strangers want to know whether to invest. *Be honest.* "Personal project; pull requests welcome but I make no commitments about response time" is a **better** answer than vague aspirational language.

**A LICENSE file.** No license = legally, no one can use the code. Chessdirbek already has a `LICENSE` file — verify it's the one actually wanted. MIT and Apache 2.0 are the standard permissive choices; pick MIT for the absolute minimum friction for adoption. This is a 2-minute decision but the *most legally consequential* one in the whole project.

**A `.gitignore` that actually excludes the right things.** Before going public, audit what's already committed. Look for committed `.db` files, API keys, `.env` files, the local SQLite database, contents of `backups/`. Run `git log --all --full-history -- '*.db'` to see if the database was ever committed — once a secret is in git history, scrubbing it is painful. Easier to know now than later.

**A working install path on a fresh machine.** Clone the repo into a fresh directory (or a Docker container) and follow the README from scratch. This catches embarrassing things — hardcoded paths to a home directory, missing dependencies, undocumented manual steps. Almost every first-time-public project fails this test.

### Strongly recommended — do soon, but don't block going public on these

- **`CONTRIBUTING.md`** — even a 10-line file. "Here's how to set up a dev environment, run tests, and what style I prefer for PRs." Sets expectations and saves answering the same questions repeatedly.
- **Issue templates** in `.github/ISSUE_TEMPLATE/`. One for bug reports, one for feature requests. Forces reporters to give the info you need (steps to reproduce, browser/OS) instead of "it's broken."
- **`CHANGELOG.md`** — running log of notable changes per version. Standard format: keepachangelog.com. People (especially other developers) trust projects that visibly track changes.
- **Tag a v0.1.0 release.** Even with continued development on `main`, a tagged release gives people a stable point to fork from and sets the precedent that versioning is taken seriously.
- **Screenshots / demo media in a `docs/` folder.** Host the actual files in the repo, not on Imgur. Nothing kills a README faster than broken image links.

### Often-suggested but actually overrated at this stage

These get piled onto "go public" checklists online and most are overhead for a project at Chessdirbek's stage:

- **CI/CD workflows.** GitHub Actions running tests on every push *sounds* essential. For a single-developer hobby project with no contributors yet, it's mostly cosmetic. Add it when there are actual collaborators or when failed deploys would burn you. Not before.
- **Code coverage badges.** Vanity metric for solo projects.
- **Detailed `CODE_OF_CONDUCT.md` / governance docs.** Required for big multi-org open source. Wildly premature for a personal project. If adopting one, use the standard Contributor Covenant text — don't write a custom one.
- **Multi-platform deployment artifacts (Docker, Helm charts).** Add when someone asks. Don't pre-build.
- **Heavy documentation sites (Docusaurus, MkDocs).** Until the README outgrows itself, this isn't needed. Most successful projects live with just the README for years.

---

## Specifically for Chessdirbek

A few things particular to this project that should be handled before going public:

**The hardcoded `user_id = 1`.** Per `CLAUDE.md`, this is a single-user MVP. That's *fine* — but the README needs to say so up front. "Chessdirbek is currently single-user; multi-user auth is not implemented." Otherwise people will deploy it expecting accounts.

**SQLite and deployment posture.** The app is designed to run locally. If others are meant to use it, the README should be explicit: "designed to run locally; not hardened for public-internet hosting." Otherwise someone exposes port 8000 to the internet and the project becomes a footnote in a security writeup.

**The accumulated spec markdown files.** There are roughly 25 `*-SPEC.md` files at the repo root from iterative development. To strangers, those are confusing noise — they look like authoritative documentation but are actually historical scratchpads. Move them to `docs/specs/` or delete the ones no longer relevant. The repo root should be welcoming, not overwhelming.

**Stockfish WASM binary attribution.** It's vendored in `frontend/vendor/stockfish/`. Stockfish is GPLv3 and Chessdirbek redistributes it, so the `LICENSE` file or a separate `NOTICES.md` must correctly attribute it. This one is **not optional** — it's a legal requirement.

**Test file layout.** `cleanup_test_data.py`, `fix_test.py`, scattered `test_*.py` at the repo root look chaotic. Move all tests under `tests/` and use a real test runner. Small mechanical fix; big credibility upgrade for contributors.

---

## Suggested order of operations

1. **Finish the PWA work** as a separate focused session. Get install + offline-caching working cleanly.
2. **Audit and clean** — check for committed secrets/databases, decide what to do with the spec files, move tests under `tests/`.
3. **Rewrite the README** with the structure above. Take a real screenshot. State the project's nature honestly.
4. **Verify LICENSE** and add Stockfish attribution.
5. **Test the install path on a fresh clone.** Most often-skipped step. Most often-embarrassing one.
6. **Tag v0.1.0** and flip the repo to public.
7. *Later, as needed*: `CONTRIBUTING.md`, issue templates, CI, `CHANGELOG.md`.

Steps 1–5 are real work. The rest can be added as you go.

---

## What to ask Claude next

Two natural follow-up sessions, either order:

- **"PWA polish"** — register the service worker, set up an offline caching strategy, add an install prompt, verify Lighthouse PWA score.
- **"Pre-release audit"** — scan for committed secrets, oversized files, broken paths, hardcoded user paths, and produce a concrete cleanup checklist.

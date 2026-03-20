# Commit log (planned) — WaterlooWorks+ MVP

Suggested git subjects below are written like a real repo: short, imperative, specific. Each block explains **what** changes and **why** it’s its own commit.

---

### 1 — `Align storage defaults and wire SW through shared schema`

**What:** One shared module owns settings version, migrations, and default shape. The service worker loads the same `storage.js` path as everything else instead of maintaining a second, smaller default object. Feature flags (`smartOverlay`, `autofill`, `applicationTracker`) land in storage. Reading settings can persist a one-time migration for older installs.

**Why:** Stops subtle bugs where the background thinks a field doesn’t exist but the options page does. Future commits can bump a version without hunting two definitions.

---

### 2 — `Put WaterlooWorks DOM scraping behind a small adapter`

**What:** Move table row finding, link-to-job-id parsing, and “what page am I on?” glue out of giant content scripts into `ww-dom-adapter.js` / `ww-selectors.js`. Call sites ask for things like rows or application tables instead of raw `querySelector` strings scattered everywhere.

**Why:** When WaterlooWorks changes markup, you fix one module (and tests) instead of `listings.js` plus `posting.js` plus whatever you add later.

---

### 3 — `Add stable job IDs and local store shapes for applications`

**What:** Introduce `job-identity.js` (same job = same key: id → URL → fallback fingerprint). Add `application-store.js` and `profile-store.js` with clear record shapes, merge rules, and status transitions wired to `chrome.storage.local`.

**Why:** Overlay, autofill, and tracker must not disagree about “which job this is.” Doing this before UI avoids renaming keys twice.

---

### 4 — `Split listings pipeline into fetch → parse → overlay model`

**What:** Refactor listings so phases are explicit: find rows, cheap metadata, fetch/posting HTML, parse job, score, build one **view model** object per row (`job-overlay-model.js`). Extend parsed fields (location, term length, doc requirements, etc.) where the parser can support it.

**Why:** Makes the UI layer dumb and testable; easier to add caching and “partial data” states without duplicating logic.

---

### 5 — `Show badges and row cues on the job list`

**What:** Inline badges (stack, location, friction, fit) and light row styling in `listings-overlay.css`, driven by the view model from commit 4. Safe against table re-sort/re-render (re-apply, don’t stack duplicate nodes).

**Why:** First commit a student **feels** in two seconds: less reading, faster triage.

---

### 6 — `Unify job inspector panel on list + posting pages`

**What:** One inspector component (`job-inspector-view.js`) fed by the same model—sections for requirements, gaps, docs, “why we said this.” Stub buttons for “autofill prep” / “track” that don’t do much yet.

**Why:** Avoid two diverging panels. Sets up the next milestones without lying about what the buttons do.

---

### 7 — `Multiple resume profiles in settings`

**What:** Move from a single global resume blob to named profiles (resume text, parsed skills, overrides, snippets). Migration: current data becomes “Default” profile. App UI to add/switch active profile; popup can show active name or link to app.

**Why:** Autofill needs “which CV and which answers” without copy-paste between co-op seasons.

---

### 8 — `Autofill: classify form fields and build a fill plan (no DOM yet)`

**What:** `field-classifier-rules.js` + mapper + resolvers output a structured plan: field → intent (e.g. program, work auth) → proposed value + confidence. No typing into inputs in this commit.

**Why:** You can unit test classification cheaply. Rushing straight to `.value =` hides wrong mappings until production.

---

### 9 — `Autofill panel: preview then apply on apply forms`

**What:** New content path (`application-form.js`) opens a Shadow DOM panel: pick profile, review high/low confidence, one button applies to inputs. No auto-submit. Uploads get copy/hint UX, not silent file injection.

**Why:** Students stay in control; fewer support threads about “it submitted the wrong thing.”

---

### 10 — `Log an application when submit actually sticks`

**What:** On strong DOM evidence of success (confirmation text, known redirect, etc.), upsert `ApplicationRecord` with job key, employer/title snapshot, profile id, timestamp, optional evidence blob. Toast or inline “saved to tracker.”

**Why:** Tracker without manual entry depends on conservative detection—not guessing on every click.

---

### 11 — `Refresh tracker from My Applications views`

**What:** `applications.js` parses WW’s applications/history tables; `application-reconciler.js` merges WW status into local timeline events (interview, rejected, offer). Idempotent: visiting the page twice doesn’t duplicate noise.

**Why:** Status changes without revisiting the apply form; local store stays close to reality.

---

### 12 — `Applications table in the app + popup shortcut`

**What:** Full dashboard in `app.html`: filters, buckets, deep links to cached job/open WW. Popup shows count or last updated + “open tracker.”

**Why:** Dense UI belongs in the app; keep the toolbar popup thin.

---

### 13 — `Debounce rerenders, surface breakage, add fixture tests`

**What:** Tighter mutation handling in listings/autofill paths; user-visible “WW layout changed” states; `logger.js` gated behind a flag. Tests on adapter, reconciler, mapper using saved HTML snippets.

**Why:** Real users hit AJAX tables and half-broken WW deploys; this commit is the “don’t ghost the user” pass before wider rollout.

---

### 14 — `Local event log + short docs for messages and storage`

**What:** `event-log.js` appends small structured events (overlay shown, autofill applied, status merged) locally. Stub or document extension message types you’ll want for later AI/sync. `docs/architecture.md` + `docs/storage-contracts.md` describe module boundaries.

**Why:** Gives you an upgrade path to analytics or cloud sync without bolting a server on day one.

---

## Done already

- **Commit 1** is implemented in the repo (see git history for the `schema.js` / service worker / guard changes). The subject line there may differ; you can `git commit --amend` to match `Align storage defaults...` if you want naming consistency.

---

## Copy-paste subjects only (for `git commit -m`)

```
Align storage defaults and wire SW through shared schema
Put WaterlooWorks DOM scraping behind a small adapter
Add stable job IDs and local store shapes for applications
Split listings pipeline into fetch, parse, overlay model
Show badges and row cues on the job list
Unify job inspector panel on list and posting pages
Multiple resume profiles in settings
Autofill: classify fields and build fill plan only
Autofill panel: preview then apply on apply forms
Log an application when submit actually sticks
Refresh timeline from My Applications pages
Applications table in the app and popup shortcut
Debounce rerenders, surface breakage, add fixture tests
Local event log and docs for storage and messages
```

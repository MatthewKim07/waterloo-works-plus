# WaterlooWorks+

<p align="center">
  <img src="src/assets/icons/icon-128.png" alt="WaterlooWorks+ logo" width="96" />
</p>

<h1 align="center">WaterlooWorks+</h1>

<p align="center">
  A client-side Chrome extension that makes WaterlooWorks easier to search, rank, and analyze.
</p>

<p align="center">
  <strong>📄 Resume-aware matching</strong> ·
  <strong>🧠 Job posting analysis</strong> ·
  <strong>📊 Ratings insights</strong> ·
  <strong>🔒 Local-only processing</strong>
</p>

---

> [!IMPORTANT]
> This repository is published for portfolio/showcase purposes only. No license is granted for reuse, modification, or redistribution.

> [!NOTE]
> All processing happens locally in the browser using `chrome.storage.local`. There is no backend service for resume data, job data, or user profiles.

## ✨ What It Does

WaterlooWorks+ is a Manifest V3 Chrome extension built to improve the default WaterlooWorks experience with:

- smarter job ranking based on resume and preferences
- structured extraction of requirements from job postings
- hiring-history and work-term ratings insights
- local tracking helpers for applications and profiles
- optional autofill planning and resume profile management

## 🎯 Feature Snapshot

| Feature | What it adds |
|---|---|
| 📄 Resume parsing | Upload or paste `PDF`, `DOCX`, or `TXT` resumes and convert them into structured skill/profile signals |
| 🏷️ Re-ranked job listings | Re-scores listings and surfaces fit indicators directly in the listings experience |
| 🔍 Posting intelligence | Extracts requirements, constraints, and recommendation signals from individual job postings |
| 📊 Ratings analysis | Parses WaterlooWorks ratings pages into clearer compatibility and viability insights |
| 🧾 Application tracking | Stores local tracker rows and application-related events in browser storage |
| 🛠️ Profile controls | Supports named resume profiles and preference-based matching behavior |
| ⚡ Background probing | Uses a constrained background workflow to hydrate job posting details from WaterlooWorks pages |

## 🔒 Privacy / Scope

This project is intentionally local-first:

- no remote database
- no hosted API
- no external analytics
- no third-party auth
- no storage outside the browser's local extension storage

The extension is scoped to WaterlooWorks domains in [`manifest.json`](manifest.json), and background fetch behavior is restricted to WaterlooWorks URLs in [`src/background/service-worker.js`](src/background/service-worker.js).

## 🧱 Tech Overview

- **Platform:** Chrome Extension, Manifest V3
- **UI surfaces:** popup, app/options page, content-script overlays
- **Storage:** `chrome.storage.local`
- **Architecture:** shared parsing/scoring modules reused across content scripts and app pages
- **Processing model:** all analysis is performed client-side in the browser

## 🗂️ Project Layout

```text
.
├── manifest.json
├── package.json
├── docs/
│   ├── architecture.md
│   └── storage-contracts.md
└── src/
    ├── app/          # full-page settings / dashboard UI
    ├── background/   # MV3 service worker
    ├── content/      # WaterlooWorks page integrations
    ├── popup/        # extension popup
    ├── shared/       # parsers, storage, scoring, helpers
    └── assets/icons/ # branding assets
```

## 🚀 Run Locally

No build step is required.

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repository root

### Open the app page

- Click the extension icon and open **WaterlooWorks+ App**
- Or open it from the extension's details page via **Extension options**

## ✅ Quick Check

If you want a lightweight syntax check:

```bash
npm run check
```

## 🧠 Core Capabilities

Implemented across [`src/shared/`](src/shared):

- `parseResume(text)`
- `parseJobPosting(htmlOrDoc)`
- `computeSkillMatch(resumeSkills, jobRequired, jobPreferred, fullText)`
- `parseRatingsPage(doc)`
- `computeTermCompatibility(userTerm, termDist)`
- `computeFacultyAlignment(userFaculty, facultyDist)`
- `computeSelectivity(hiresByTermTable)`
- `computeViabilityScore(skill, term, faculty, selectivity)`
- `recommendAction(viability, flags)`

## ⚠️ Limitations

- PDF extraction is heuristic and may fail on scanned/image PDFs
- DOCX extraction depends on ZIP/deflate parsing and may fail for unusual encodings
- Ratings chart extraction depends on what data WaterlooWorks exposes in the DOM
- Some selectors are intentionally heuristic and may need tuning if WaterlooWorks changes its markup

## 📘 Additional Notes

- Storage keys are documented in [`docs/storage-contracts.md`](docs/storage-contracts.md)
- Architecture notes are documented in [`docs/architecture.md`](docs/architecture.md)
- The repository currently contains no public-use license by design

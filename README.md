# WaterlooWorks+

WaterlooWorks+ is a client-side Chrome Extension (Manifest V3) MVP that enhances WaterlooWorks with:

1. Resume-based job matching and re-ranking
2. Job description intelligence extraction
3. Hiring history + work term ratings intelligence with a viability score

All processing is done locally in the browser (`chrome.storage.local`), with no backend service.

## Features (MVP)

- Resume upload/paste in options page (`PDF`, `DOCX`, `TXT`, or pasted text)
- Resume parsing (`parseResume`) using dictionary + regex + n-gram scoring
- Listings-page job scraping + re-ranking with score badges
- Posting-page requirement extraction + constraints chips + recommendation panel
- Ratings-page chart/table parsing + compatibility insights + recommendation panel
- Composite viability scoring with explainable breakdown
- Global enable toggle + per-page disable toggle
- Cache for parsed job postings in local storage
- Concurrency-limited background fetches for postings

## Folder Structure

```text
.
├── manifest.json
├── package.json
├── README.md
└── src
    ├── background
    │   └── service-worker.js
    ├── content
    │   ├── common.js
    │   ├── listings.js
    │   ├── posting.js
    │   └── ratings.js
    ├── options
    │   ├── options.css
    │   ├── options.html
    │   └── options.js
    ├── popup
    │   ├── popup.css
    │   ├── popup.html
    │   └── popup.js
    └── shared
        ├── job-parser.js
        ├── ratings-parser.js
        ├── resume-parser.js
        ├── scoring.js
        ├── skills.js
        ├── storage.js
        ├── ui.js
        └── utils.js
```

## Install in Chrome (Load Unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder (root containing `manifest.json`).

## Build / Run

No build step is required for this scaffold.

- Use directly as an unpacked extension.
- Optional syntax check:

```bash
npm run check
```

## Where to Configure Matching Dictionaries

Update `src/shared/skills.js`:

- `SKILLS_DICTIONARY`
- Each entry supports: `key`, `aliases`, `category`, `baseWeight`

## Core Shared Functions

Implemented in `src/shared/*`:

- `parseResume(text)`
- `parseJobPosting(htmlOrDoc)`
- `computeSkillMatch(resumeSkills, jobRequired, jobPreferred, fullText)`
- `parseRatingsPage(doc)`
- `computeTermCompatibility(userTerm, termDist)`
- `computeFacultyAlignment(userFaculty, facultyDist)`
- `computeSelectivity(hiresByTermTable)`
- `computeViabilityScore(skill, term, faculty, selectivity)`
- `recommendAction(viability, flags)`

## Notes on WaterlooWorks DOM Parsing

Selectors are intentionally resilient and heuristic. Some selectors include `TODO` comments where site-specific tuning is expected.

## Limitations

- PDF extraction is heuristic and may fail on scanned/image PDFs.
- DOCX extraction uses ZIP/deflate parsing and may fail for uncommon document encodings.
- Ratings chart extraction depends on DOM accessibility:
  - First tries aria/legend/script data
  - If not available, falls back to table-driven insights
  - If chart values are inaccessible, shows chart-unavailable notices
- Page detection and row parsing may require minor selector updates if WaterlooWorks DOM changes.


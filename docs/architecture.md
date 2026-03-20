# WaterlooWorks+ layout

**MV3** — service worker in `src/background/`, content scripts in `src/content/`, shared logic in `src/shared/`, full-page UI in `src/app/`.

**Storage** — local-only: `wwpSettings`, `wwpJobAnalysisCache`, `wwpProfiles`, `wwpApplications`, optional `wwpEventLog` / `wwpDebug`. See `storage-contracts.md`.

**Note** — Content scripts use `all_frames: true`. Probe tabs skip most UI via `common.js`.

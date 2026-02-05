# DEVELOPER GUIDE — AMR-X

This guide helps contributors understand project layout, local development, and extension points.

Repository Layout

- `Backend/` — Express API, ingestion routes, analytics endpoints
  - `routes/` — endpoint implementations (analytics, ingest, chatbot)
  - `services/` — domain logic (mlService, rwuiService, excelParser)
- `src/` — frontend static pages, scripts, and styles
  - `src/scripts/` — frontend logic (analytics, uploads, auth)
  - `src/assets/` — icons and images
- `scripts/` — helper scripts (e.g., `generate_screenshots.js`)
- `screenshots/` — generated images for README and releases
- `sql/` — example SQL and migrations

Local Development

1. Start backend

```bash
cd Backend
npm install
# add .env with SUPABASE_URL and SUPABASE_KEY
npm start
```

2. Serve frontend

```bash
# from repo root
npx http-server -c-1 .
# or use VS Code Live Server to open files under src/
```

3. Run helper scripts

```bash
# generate optimized screenshots (uses sharp)
npm install
npm run generate:screenshots
```

Testing & CI

- There are simple test scripts in `Backend/` (`test*.js`). Add unit tests and integrate them into CI.
- The repository includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on push/PR.

Extending the System

- Add new analytics endpoints under `Backend/routes/analytics.js` and corresponding service logic under `services/`.
- For ML integration, implement calls to the inference engine in `mlService.js`.
- Add e2e tests for upload and analytics flows.

Contribution Workflow

1. Fork repository
2. Create a feature branch
3. Add tests for new behavior
4. Open a PR with a clear description and screenshots (put screenshots in `screenshots/` if applicable)

Code Style

- Keep frontend JS modular and DOM-focused (no frameworks currently used).
- Keep backend services single-responsibility and testable.

Contact

If you have questions, open an issue describing the feature/bug and tag repository maintainers.
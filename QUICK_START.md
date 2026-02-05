# QUICK START — AMR-X (5 minutes)

This quick start will get you running the AMR-X dashboard locally.

Prerequisites

- Node.js (>= 18)
- npm
- Optional: Live Server or any static server for frontend

Steps

1. Backend

```bash
cd Backend
npm install
# create Backend/.env with SUPABASE_URL, SUPABASE_KEY, PORT (optional)
npm start
# verify
curl http://localhost:3001/api/health
```

2. Frontend

- Serve the `src/` folder using Live Server or a static server:

```bash
# from repository root
npx http-server -c-1 .
# open http://localhost:8080/src/analytics.html
```

3. Upload Data

- Open `src/upload-data.html` and upload an example Excel file or use `POST /api/ingest-upload`.

4. Regenerate Screenshots (optional)

```bash
npm install
npm run generate:screenshots
```

Troubleshooting

- If dashboard shows no data: ensure backend is running and ingestion completed.
- For errors, open browser console (F12) and backend logs.

That's it — you should now see the dashboard and RWUI metrics.
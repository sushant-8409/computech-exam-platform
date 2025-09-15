Netlify CLI Deploy Instructions

Prerequisites:
- Install Netlify CLI globally or use npx: `npm install -g netlify-cli` or use `npx netlify` in commands.
- Ensure you have a Netlify account and a site created (or you can use `netlify init` to create one interactively).
- Make sure the `frontend` app builds to `frontend/build` (React default)

Quick deploy (uses package.json script):

```powershell
# From repository root (Windows PowerShell)
npm run netlify:deploy
```

This runs `npm run build` for the frontend and then runs `npx netlify deploy --prod --dir=frontend/build`.

If you prefer to do it step-by-step:

```powershell
# Build frontend
cd frontend; npm run build
# Deploy (interactive, will ask for site)
npx netlify deploy --prod --dir=build
```

Notes:
- For CI, set `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` as environment variables to perform non-interactive deploys:

```powershell
$env:NETLIFY_AUTH_TOKEN = 'your_token'
$env:NETLIFY_SITE_ID = 'your_site_id'
npx netlify deploy --prod --dir=frontend/build
```

- If you need to rollback, use `npx netlify sites:list` and `npx netlify deploy --site=<SITE_ID> --prod --dir=frontend/build`.

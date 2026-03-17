# PythonAnywhere Keep Alive

This repository runs a weekly GitHub Action that logs into PythonAnywhere, opens the `Web` page, and clicks `Run until 1 month from today` for a free web app.

## Setup

1. Create a GitHub repository from this folder.
2. In the repository, add these Actions secrets:
   - `PYTHONANYWHERE_LOGIN`: your PythonAnywhere username or email address
   - `PYTHONANYWHERE_PASSWORD`: your PythonAnywhere password
3. Add this repository variable if you want the script to open a specific app tab after it reaches the `Web` page:
   - `PYTHONANYWHERE_WEBAPP_LABEL`: for example `Ahsan728.pythonanywhere.com`
4. Enable GitHub Actions for the repository.

## Schedule

The workflow runs every Monday at `06:00 UTC` and can also be started manually from the Actions tab with `workflow_dispatch`.

## Local run

```powershell
$env:PYTHONANYWHERE_LOGIN="your-login"
$env:PYTHONANYWHERE_PASSWORD="your-password"
$env:PYTHONANYWHERE_WEBAPP_LABEL="Ahsan728.pythonanywhere.com"
npm install
npx playwright install chromium
npm run renew
```

Screenshots are written to the `artifacts/` folder for troubleshooting.

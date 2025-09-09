# Deployment Setup

## Automatic Deployment with GitHub Actions

I've created a GitHub Actions workflow that will automatically deploy to Fly.io when you push to the `main` branch.

### Setup Steps:

1. **Get your Fly.io API Token:**
   ```bash
   flyctl auth token
   ```

2. **Add the token to GitHub Secrets:**
   - Go to your GitHub repository
   - Click Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `FLY_API_TOKEN`
   - Value: (paste the token from step 1)

3. **Push your changes:**
   ```bash
   git add .
   git commit -m "Add automatic deployment"
   git push
   ```

## Manual Deployment

If you want to deploy manually:
```bash
flyctl deploy
```

## View Logs

To see your app logs on Fly.io:
```bash
flyctl logs
```
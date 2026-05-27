# Proposal Forge v2

Turns meeting notes into a personalised Positive proposal. Research-backed, editable before it hits Gamma, with sourced rationale on every output field.

## Deploy to Netlify

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_ORG/proposal-forge.git
git push -u origin main
```

### 2. Connect to Netlify

- Go to [app.netlify.com](https://app.netlify.com) → Add new site → Import from GitHub
- Select the repo
- Build settings are pre-configured in `netlify.toml` — no changes needed

### 3. Set the API key

In Netlify: **Site settings → Environment variables → Add variable**

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

Then trigger a redeploy: **Deploys → Trigger deploy → Deploy site**

### Local development

```bash
npm install
npm run dev
```

For local dev with the Netlify Function, install the Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

Set `ANTHROPIC_API_KEY` in a `.env` file at the project root (never commit this):

```
ANTHROPIC_API_KEY=sk-ant-...
```

## How it works

1. **Input** — fill in the account, meeting notes, and your details
2. **Research** — Claude searches the web and synthesises a brief
3. **Review** — edit any field before it goes to Gamma; each field has a "Why this?" source note
4. **Generate** — sends to your Positive proposal template in Gamma

The API key lives in a Netlify serverless function (`netlify/functions/claude.cjs`) and is never exposed to the browser.

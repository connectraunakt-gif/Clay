# Clay

A vanilla HTML, CSS, and JavaScript progressive web app for small-business owners. No React, framework runtime, or build step is required for the interface.

## Architecture

- `index.html`, `styles.css`, `js/app.js`: onboarding, real account sign-in, business discovery, canvas editor, contextual tools, profile and activity.
- `js/model.js`: validated structured actions, scoped restoration, semantic responsive rendering, standalone multi-page PWA export.
- `js/api.js`: Supabase authentication, transactional saves, versions and owner-only reads.
- `supabase/functions/clay`: authenticated AI proxy, publication coordinator, public contact and visit ingestion. Private API credentials remain here.
- `supabase/migrations`: row-level security, atomic version saves, optimistic concurrency, rate limiting and a UNIQUE user constraint enforcing **one website per account**.
- `.github/workflows/pages.yml`: tests and deployment of only the public interface files. Server code and private environment files are never included in the Pages artifact.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm start
```

Open http://localhost:4173. The example editor is explicitly labelled and keeps changes only for that session. Real websites require sign-in and are stored in Supabase, not local storage. Local storage holds the theme, Supabase session and (on published sites) an anonymous visitor identifier.

## Configure the services

The project URL and public publishable key are in `config.js`. Public keys are safe to ship; row-level security protects user records. Never put service-role keys, GitHub tokens, management tokens or AI credentials in this file.

1. Copy `.env.example` to `.env` and fill in its values. Add `SUPABASE_ACCESS_TOKEN` for initial project administration. The file is ignored by Git.
2. Give the GitHub publishing credential access to the repository and to its Actions runs. It needs Contents, Pages, Administration and Workflows write permissions. Generated websites use separate folders in this existing repository; no new repositories are required. Use a GitHub App for a production service shared by unrelated customers.
3. Run `node scripts/configure-pages.mjs` to configure the Clay repository for Actions-based Pages deployment. The actual URL is read from GitHub's Pages API.
4. Run `node scripts/setup-backend.mjs`. It installs the migration if absent, configures email redirects from the actual Pages URL, uploads server secrets, and deploys the function using the Supabase CLI. Existing schemas are not destructively reset.
5. In Supabase Authentication, enable Google using your Google OAuth client credentials. Register the Supabase callback URL in Google Cloud. If `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set locally, the setup script can enable the Supabase provider. Google Cloud configuration remains an account-owner action.
6. Push `main`. The workflow runs tests and deploys only static client files.

Supabase's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied automatically inside hosted functions. `verify_jwt = false` permits public contact and analytics requests; **every private action independently verifies the bearer token using `auth.getUser` and checks website ownership**.

## Editing and publishing

All edits operate on a validated model. Atomic batches either succeed in full or leave the original unchanged. Saves preserve the previous website and use a revision check to avoid overwriting another tab's changes. An account can store one website. Undo/redo is session-local; the latest 100 saved snapshots persist. Restoration can target a complete website, page, section, element, navigation or theme. If a selected part has been deleted, restore its parent or the website.

Photos can be uploaded directly; the browser compresses them and embeds them in the model so draft photos remain private with the website. A model is limited to 500 KB. Image links can also be used. The renderer escapes text and restricts image/link schemes; generated code never executes inside Clay with access to Clay's origin.

Publishing commits a separate `published/<website-id>/` folder inside the configured Clay repository, then the Pages workflow deploys it under `sites/<website-id>/`. The final URL combines the actual Pages API URL with that known output path. The exact commit’s Actions run must succeed before the site is marked live. A failed workflow preserves the previous live deployment; the shared branch is never force-reset. Editing during publication produces “Changes ready to publish” afterward. Unpublishing removes that website’s directory and waits for deployment.

Export downloads a ZIP containing HTML for every page, embedded CSS/JavaScript, a manifest, service worker and icon. The files work independently from the editor. Contact and visitor collection require the deployed Clay function and the matching published origin. Custom-domain connection is **not offered** in this version.

## Privacy and analytics

Website owners alone can read their websites, snapshots, messages and visitor records. Anonymous requests cannot read these tables. Public ingestion validates payloads, checks the published origin, rate-limits callers and uses a contact-form honeypot. Analytics respects the browser's Do Not Track preference. Visitors are counted once per browser/day; unique visitors once per browser in the reporting period. Time is approximate, capped at 30 minutes per page view. Location remains unavailable rather than inventing geography. There is no advertising tracking or CRM.

For production, add an independent security review, stronger abuse protection (for example Turnstile), transactional email delivery, operational monitoring, retention controls, backups, and GitHub App credentials. These are not represented as implemented features.

## Validation

```sh
npm test
npx playwright install chromium
node tests/browser.mjs    # local server must be running
node tests/backend.mjs    # real isolation checks; temporary accounts are deleted
node tests/ai.mjs         # real NVIDIA calls; temporary account is deleted
```

The backend tests require the local management token. They create only dedicated `example.invalid` test accounts, verify isolation and the one-site constraint, and remove them in a `finally` block. Browser screenshots remain under ignored `.playwright/`.

## Service documentation

- [Supabase email sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithotp)
- [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Edge Function deployment](https://supabase.com/docs/guides/functions/deploy)
- [GitHub Pages API](https://docs.github.com/en/rest/pages)
- [NVIDIA language-model APIs](https://docs.api.nvidia.com/nim/re/reference/llm-apis)

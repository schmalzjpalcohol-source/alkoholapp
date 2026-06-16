# ProofFlow

Static mobile React app for GitHub Pages. Users enter an arrival/departure check, name, BAC value, take two photos, generate a lightweight text report, and open a prepared email draft.

GitHub Pages cannot run a backend, store a database, or silently send email attachments. The app therefore creates the report file in the browser and prepares the email subject/body with all structured data.

## Set Recipient

Edit the recipient in `src/App.jsx`:

```js
const RECIPIENT_EMAIL = "recipient@example.invalid";
```

## Local Start

```bash
npm install
npm run client:dev
```

Open the Vite URL shown in the terminal.

## Build For GitHub Pages

```bash
npm run build:pages
```

Commit and publish the generated `docs` folder with GitHub Pages.

Recommended Pages settings:

```text
Source: Deploy from a branch
Branch: test/githubpages_test
Folder: /docs
```

## GitHub Pages Notes

- No login is included because GitHub Pages is static.
- No database is included because there is no server process.
- The generated report is a lightweight `.txt` file.
- Email opens with `mailto:` and includes the subject/body.
- Photo attachments still need the user's email/share sheet because static GitHub Pages cannot send files by itself.

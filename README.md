# ProofFlow

Static React app for GitHub Pages. Users enter their details, take two photos, generate one finished HTML submission file, and open an email draft for sending it.

GitHub Pages cannot run a backend, store a database, or attach files to email automatically. The app therefore creates the finished file in the browser. The user downloads that file and attaches it to the opened email.

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

Upload or publish the generated `dist` folder with GitHub Pages.

## GitHub Pages Notes

- No login is included because GitHub Pages is static.
- No database is included because there is no server process.
- Photos are embedded into the generated HTML file.
- Email opens with `mailto:`. The downloaded file still needs to be attached manually.

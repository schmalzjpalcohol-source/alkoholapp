# ProofFlow

React + Node web app for Railway. Users sign in, submit two photos from an iPhone browser, and supervisors review all submissions by user and date.

Railway is a good fit for this MVP because the web app, Node API, and PostgreSQL database can run in one project. Please check current Railway pricing before production use because free/trial rules can change. For photo storage, use a Railway Volume or object storage.

## Local Start

```bash
npm install
cp .env.example .env
npm run local
```

Open: `http://127.0.0.1:3000`

If `DATABASE_URL` is empty, the app starts in local demo mode and stores data in `data/local-db.json`. On Railway, set `DATABASE_URL` and the same code reads/writes PostgreSQL.

## Test Accounts

These accounts are seeded from ENV on every start:

- Admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- User: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`
- Extra admin: `EXTRA_ADMIN_EMAIL` / `EXTRA_ADMIN_PASSWORD`
- Extra user: `EXTRA_USER_EMAIL` / `EXTRA_USER_PASSWORD`

Defaults:

- Admin: `admin@example.invalid` / `admin`
- Extra admin: `supervisor@example.invalid` / `supervisor123`
- User: `user@example.invalid` / `user`
- Extra user: `driver@example.invalid` / `driver123`

## Railway

1. Neues Railway-Projekt erstellen.
2. PostgreSQL-Service hinzufuegen.
3. Dieses Repo deployen.
4. Optional ein Volume nach `/data` mounten, damit hochgeladene Bilder persistent gespeichert werden.
5. ENV setzen:

```bash
DATABASE_URL=...
SESSION_SECRET=...
ADMIN_EMAIL=admin@example.invalid
ADMIN_PASSWORD=...
EXTRA_ADMIN_EMAIL=supervisor@example.invalid
EXTRA_ADMIN_PASSWORD=...
TEST_USER_EMAIL=test@example.invalid
TEST_USER_PASSWORD=...
EXTRA_USER_EMAIL=driver@example.invalid
EXTRA_USER_PASSWORD=...
DATA_DIR=/data
```

Wenn kein Volume genutzt wird, speichert Railway Dateien nur ephemer. Fuer echte Nutzung also unbedingt Volume/Object Storage oder S3-kompatiblen Speicher verwenden.

Railway Start Command:

```bash
npm run start
```

Railway Build Command:

```bash
npm install && npm run build
```

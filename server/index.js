import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import multer from "multer";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

loadEnvFile(path.join(rootDir, ".env"));

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const dataDir = path.resolve(process.env.DATA_DIR || path.join(rootDir, "data"));
const uploadDir = path.join(dataDir, "uploads");
const sessionSecret = process.env.SESSION_SECRET || "dev-secret-change-me";
const databaseUrl = process.env.DATABASE_URL;
const localDbFile = path.join(dataDir, "local-db.json");

fs.mkdirSync(uploadDir, { recursive: true });

const pool = databaseUrl
  ? new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("railway.internal") ? false : databaseUrl.includes("railway") ? { rejectUnauthorized: false } : undefined
    })
  : null;

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname || ".jpg") || ".jpg";
    callback(null, `${crypto.randomUUID()}${ext.toLowerCase()}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith("image/"));
  }
});

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const candidate = crypto.scryptSync(password, salt, 64);
  const storedHash = Buffer.from(hash, "hex");
  return storedHash.length === candidate.length && crypto.timingSafeEqual(storedHash, candidate);
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function readSession(req) {
  const token = req.cookies.session;
  if (!token) return null;
  const [body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", sessionSecret).update(body).digest("base64url");
  if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (session.expiresAt < Date.now()) return null;
  return session;
}

function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: "Not signed in." });
  req.session = session;
  next();
}

function requireAdmin(req, res, next) {
  if (req.session?.role !== "admin") return res.status(403).json({ error: "Admin access required." });
  next();
}

function seedAccounts() {
  return [
    {
      email: process.env.ADMIN_EMAIL || "admin@example.invalid",
      name: "Admin Supervisor",
      role: "admin",
      password: process.env.ADMIN_PASSWORD || "admin"
    },
    {
      email: process.env.EXTRA_ADMIN_EMAIL || "supervisor@example.invalid",
      name: "Test Supervisor",
      role: "admin",
      password: process.env.EXTRA_ADMIN_PASSWORD || "supervisor123"
    },
    {
      email: process.env.TEST_USER_EMAIL || "user@example.invalid",
      name: "Test User",
      role: "user",
      password: process.env.TEST_USER_PASSWORD || "user"
    },
    {
      email: process.env.EXTRA_USER_EMAIL || "driver@example.invalid",
      name: "Demo Driver",
      role: "user",
      password: process.env.EXTRA_USER_PASSWORD || "driver123"
    }
  ];
}

async function migrate() {
  if (!pool) {
    await migrateLocal();
    return;
  }

  await pool.query(`
    create extension if not exists "pgcrypto";

    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      email text unique not null,
      name text not null,
      role text not null check (role in ('user', 'admin')),
      password_hash text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists submissions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      person_photo text not null,
      device_photo text not null,
      note text,
      created_at timestamptz not null default now()
    );

    create index if not exists submissions_created_idx on submissions (created_at desc);
    create index if not exists submissions_user_idx on submissions (user_id, created_at desc);
  `);

  for (const account of seedAccounts()) {
    await seedUser(account.email, account.name, account.role, account.password);
  }
}

async function seedUser(email, name, role, password) {
  if (!pool) {
    const db = readLocalDb();
    const normalizedEmail = email.toLowerCase();
    const existing = db.users.find((user) => user.email === normalizedEmail);
    const passwordHash = existing?.password_hash && verifyPassword(password, existing.password_hash)
      ? existing.password_hash
      : hashPassword(password);
    const user = {
      id: existing?.id || crypto.randomUUID(),
      email: normalizedEmail,
      name,
      role,
      password_hash: passwordHash,
      created_at: existing?.created_at || new Date().toISOString()
    };

    if (
      existing &&
      existing.name === user.name &&
      existing.role === user.role &&
      existing.password_hash === user.password_hash
    ) {
      return;
    }

    db.users = db.users.filter((item) => item.email !== normalizedEmail).concat(user);
    writeLocalDb(db);
    return;
  }

  await pool.query(
    `insert into users (email, name, role, password_hash)
     values ($1, $2, $3, $4)
     on conflict (email) do update
     set name = excluded.name, role = excluded.role, password_hash = excluded.password_hash`,
    [email.toLowerCase(), name, role, hashPassword(password)]
  );
}

function readLocalDb() {
  if (!fs.existsSync(localDbFile)) {
    return { users: [], submissions: [] };
  }

  try {
    const raw = fs.readFileSync(localDbFile, "utf8").trim();
    if (!raw) {
      return { users: [], submissions: [] };
    }

    const db = JSON.parse(raw);
    return {
      users: Array.isArray(db.users) ? db.users : [],
      submissions: Array.isArray(db.submissions) ? db.submissions : []
    };
  } catch (error) {
    console.warn("Local demo database was invalid and has been recreated.");
    return { users: [], submissions: [] };
  }
}

function writeLocalDb(db) {
  fs.writeFileSync(localDbFile, JSON.stringify(db, null, 2));
}

async function migrateLocal() {
  if (!fs.existsSync(localDbFile)) {
    writeLocalDb({ users: [], submissions: [] });
  }

  for (const account of seedAccounts()) {
    await seedUser(account.email, account.name, account.role, account.password);
  }
  console.warn("DATABASE_URL is missing. Starting local demo mode with data/local-db.json.");
}

async function getUserByEmail(email) {
  if (!pool) {
    return readLocalDb().users.find((user) => user.email === email);
  }

  const { rows } = await pool.query("select id, email, name, role, password_hash from users where email = $1", [email]);
  return rows[0];
}

async function createSubmission({ userId, personPhoto, devicePhoto, note }) {
  if (!pool) {
    const db = readLocalDb();
    const submission = {
      id: crypto.randomUUID(),
      user_id: userId,
      person_photo: personPhoto,
      device_photo: devicePhoto,
      note,
      created_at: new Date().toISOString()
    };

    db.submissions.unshift(submission);
    writeLocalDb(db);
    return submission;
  }

  const { rows } = await pool.query(
    `insert into submissions (user_id, person_photo, device_photo, note)
     values ($1, $2, $3, $4)
     returning id, created_at`,
    [userId, personPhoto, devicePhoto, note]
  );
  return rows[0];
}

async function listSubmissions() {
  if (!pool) {
    const db = readLocalDb();
    return db.submissions.map((submission) => {
      const user = db.users.find((item) => item.id === submission.user_id);
      return {
        ...submission,
        email: user?.email || "unbekannt",
        name: user?.name || "Unbekannt"
      };
    });
  }

  const { rows } = await pool.query(`
    select s.id, s.created_at, s.person_photo, s.device_photo, s.note, u.email, u.name
    from submissions s
    join users u on u.id = s.user_id
    order by s.created_at desc
    limit 200
  `);
  return rows;
}

async function listSubmissionsForUser(userId) {
  if (!pool) {
    return readLocalDb().submissions.filter((submission) => submission.user_id === userId);
  }

  const { rows } = await pool.query(
    `select id, created_at, person_photo, device_photo, note
     from submissions
     where user_id = $1
     order by created_at desc
     limit 20`,
    [userId]
  );
  return rows;
}

async function listUsers() {
  if (!pool) {
    return readLocalDb().users.map(({ password_hash, ...user }) => user);
  }

  const { rows } = await pool.query("select id, email, name, role, created_at from users order by created_at desc");
  return rows;
}

async function userOwnsFile(userId, file) {
  if (!pool) {
    return readLocalDb().submissions.some(
      (submission) => submission.user_id === userId && (submission.person_photo === file || submission.device_photo === file)
    );
  }

  const { rowCount } = await pool.query(
    "select 1 from submissions where user_id = $1 and (person_photo = $2 or device_photo = $2)",
    [userId, file]
  );
  return rowCount > 0;
}

app.post("/api/login", asyncRoute(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = await getUserByEmail(email);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }

  const session = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7
  };

  res.cookie("session", signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
  res.json({ user: session });
}));

app.post("/api/logout", (_req, res) => {
  res.clearCookie("session");
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  res.json({ user: readSession(req) });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    storage: pool ? "postgres" : "local-demo",
    time: new Date().toISOString()
  });
});

app.get("/api/demo-accounts", (_req, res) => {
  res.json({
    accounts: seedAccounts().map(({ email, password, role, name }) => ({ email, password, role, name }))
  });
});

app.get("/api/submissions", requireAuth, asyncRoute(async (req, res) => {
  res.json({ submissions: await listSubmissionsForUser(req.session.id) });
}));

app.post(
  "/api/submissions",
  requireAuth,
  upload.fields([
    { name: "personPhoto", maxCount: 1 },
    { name: "devicePhoto", maxCount: 1 }
  ]),
  asyncRoute(async (req, res) => {
    const personPhoto = req.files?.personPhoto?.[0];
    const devicePhoto = req.files?.devicePhoto?.[0];

    if (!personPhoto || !devicePhoto) {
      return res.status(400).json({ error: "Both photos are required." });
    }

    const note = String(req.body.note || "").slice(0, 500);
    const submission = await createSubmission({
      userId: req.session.id,
      personPhoto: personPhoto.filename,
      devicePhoto: devicePhoto.filename,
      note
    });

    res.status(201).json({ submission });
  })
);

app.get("/api/admin/submissions", requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  res.json({ submissions: await listSubmissions() });
}));

app.get("/api/admin/users", requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  res.json({ users: await listUsers() });
}));

app.get("/uploads/:file", requireAuth, asyncRoute(async (req, res) => {
  const file = path.basename(req.params.file);
  const filePath = path.join(uploadDir, file);

  if (req.session.role !== "admin") {
    const ownsFile = await userOwnsFile(req.session.id, file);
    if (!ownsFile) return res.status(403).end();
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).end();
  }

  res.sendFile(filePath);
}));

const distDir = path.join(rootDir, "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Server error. Please check the terminal logs." });
});

migrate()
  .then(() => {
    const server = app.listen(port, host, () => {
      console.log(`Alkoholapp listening on http://${host}:${port}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Stop the other process or set PORT=3001 in .env.`);
      } else if (error.code === "EPERM") {
        console.error(`Port ${port} cannot be opened. Try PORT=3001 in .env.`);
      } else {
        console.error(error);
      }
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

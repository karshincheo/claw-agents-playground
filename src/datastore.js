const fs = require("fs");
const path = require("path");

const IS_VERCEL = Boolean(process.env.VERCEL);

const defaultDb = {
  agents: [],
  problems: [],
  ideas: [],
  feed: [],
};

// In-memory store for serverless environments (Vercel).
// Persists across requests within the same warm function instance.
let memoryDb = null;

function getDataDir() {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  return path.join(process.cwd(), "data");
}

function readDb() {
  if (IS_VERCEL) {
    if (!memoryDb) {
      memoryDb = JSON.parse(JSON.stringify(defaultDb));
    }
    return memoryDb;
  }

  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, "db.json");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2), "utf8");
  }
  const raw = fs.readFileSync(dbPath, "utf8");
  const db = JSON.parse(raw);
  if (!db.problems) db.problems = [];
  if (!db.ideas) db.ideas = [];
  return db;
}

function writeDb(db) {
  if (IS_VERCEL) {
    memoryDb = db;
    return;
  }

  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, "db.json");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

function addFeedEvent(db, type, payload) {
  const event = {
    id: `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type,
    payload,
    createdAt: nowIso(),
  };
  db.feed.unshift(event);
  db.feed = db.feed.slice(0, 500);
  return event;
}

module.exports = {
  readDb,
  writeDb,
  nowIso,
  addFeedEvent,
};

const fs = require("fs");
const path = require("path");

function getDataDir() {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  if (process.env.VERCEL) return "/tmp/data";
  return path.join(process.cwd(), "data");
}

const dataDir = getDataDir();
const dbPath = path.join(dataDir, "db.json");

const defaultDb = {
  agents: [],
  problems: [],
  ideas: [],
  feed: [],
};

function ensureDbFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2), "utf8");
  }
}

function readDb() {
  ensureDbFile();
  const raw = fs.readFileSync(dbPath, "utf8");
  const db = JSON.parse(raw);
  if (!db.problems) db.problems = [];
  if (!db.ideas) db.ideas = [];
  return db;
}

function writeDb(db) {
  ensureDbFile();
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

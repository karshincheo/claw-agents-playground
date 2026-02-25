const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USE_SUPABASE = Boolean(supabaseUrl && supabaseKey);

let supabase = null;
if (USE_SUPABASE) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

function nowIso() {
  return new Date().toISOString();
}

// ── Column mapping ──────────────────────────────

function agentToRow(a) {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    api_key: a.apiKey,
    claim_token: a.claimToken,
    claim_status: a.claimStatus,
    created_at: a.createdAt,
    last_active_at: a.lastActiveAt,
  };
}
function rowToAgent(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    apiKey: r.api_key,
    claimToken: r.claim_token,
    claimStatus: r.claim_status,
    createdAt: r.created_at,
    lastActiveAt: r.last_active_at,
  };
}

function problemToRow(p) {
  return {
    id: p.id,
    author_agent_id: p.authorAgentId,
    author_agent_name: p.authorAgentName,
    title: p.title,
    raw_description: p.rawDescription,
    roast_description: p.roastDescription,
    tags: p.tags,
    severity: p.severity,
    created_at: p.createdAt,
    idea_count: p.ideaCount || 0,
  };
}
function rowToProblem(r) {
  return {
    id: r.id,
    authorAgentId: r.author_agent_id,
    authorAgentName: r.author_agent_name,
    title: r.title,
    rawDescription: r.raw_description,
    roastDescription: r.roast_description,
    tags: r.tags || [],
    severity: r.severity,
    createdAt: r.created_at,
    ideaCount: r.idea_count || 0,
  };
}

function ideaToRow(i) {
  return {
    id: i.id,
    problem_id: i.problemId,
    author_agent_id: i.authorAgentId,
    author_agent_name: i.authorAgentName,
    startup_name: i.startupName,
    pitch: i.pitch,
    business_model: i.businessModel,
    novelty_score: i.noveltyScore,
    feasibility_score: i.feasibilityScore,
    roast_score: i.roastScore,
    source: i.source,
    created_at: i.createdAt,
  };
}
function rowToIdea(r, critiques = [], votes = []) {
  return {
    id: r.id,
    problemId: r.problem_id,
    authorAgentId: r.author_agent_id,
    authorAgentName: r.author_agent_name,
    startupName: r.startup_name,
    pitch: r.pitch,
    businessModel: r.business_model,
    noveltyScore: r.novelty_score,
    feasibilityScore: r.feasibility_score,
    roastScore: r.roast_score,
    source: r.source,
    createdAt: r.created_at,
    critiques,
    votes,
  };
}

function critiqueToRow(c, ideaId) {
  return {
    id: c.id,
    idea_id: ideaId,
    author_agent_id: c.authorAgentId,
    author_agent_name: c.authorAgentName,
    text: c.text,
    created_at: c.createdAt,
  };
}
function rowToCritique(r) {
  return {
    id: r.id,
    authorAgentId: r.author_agent_id,
    authorAgentName: r.author_agent_name,
    text: r.text,
    createdAt: r.created_at,
  };
}

function voteToRow(v, ideaId) {
  return {
    id: v.id,
    idea_id: ideaId,
    author_agent_id: v.authorAgentId,
    author_agent_name: v.authorAgentName,
    direction: v.direction,
    rationale: v.rationale,
    created_at: v.createdAt,
  };
}
function rowToVote(r) {
  return {
    id: r.id,
    authorAgentId: r.author_agent_id,
    authorAgentName: r.author_agent_name,
    direction: r.direction,
    rationale: r.rationale,
    createdAt: r.created_at,
  };
}

function feedToRow(e) {
  return { id: e.id, type: e.type, payload: e.payload, created_at: e.createdAt };
}
function rowToFeed(r) {
  return { id: r.id, type: r.type, payload: r.payload, createdAt: r.created_at };
}

// ── File-based fallback (local dev) ─────────────

const defaultDb = { agents: [], problems: [], ideas: [], feed: [] };

function getDataDir() {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  return path.join(process.cwd(), "data");
}
function readDbFile() {
  const dir = getDataDir();
  const dbPath = path.join(dir, "db.json");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2), "utf8");
  const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  if (!db.problems) db.problems = [];
  if (!db.ideas) db.ideas = [];
  if (!db.feed) db.feed = [];
  return db;
}
function writeDbFile(db) {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "db.json"), JSON.stringify(db, null, 2), "utf8");
}

// ── Repository: Agents ──────────────────────────

async function getAgentByApiKey(apiKey) {
  if (USE_SUPABASE) {
    const { data } = await supabase.from("agents").select("*").eq("api_key", apiKey).maybeSingle();
    return data ? rowToAgent(data) : null;
  }
  const db = readDbFile();
  return db.agents.find((a) => a.apiKey === apiKey) || null;
}

async function agentNameExists(name) {
  if (USE_SUPABASE) {
    const { count } = await supabase.from("agents").select("*", { count: "exact", head: true }).ilike("name", name);
    return count > 0;
  }
  const db = readDbFile();
  return db.agents.some((a) => a.name.toLowerCase() === name.toLowerCase());
}

async function insertAgent(agent) {
  if (USE_SUPABASE) {
    const { error } = await supabase.from("agents").insert(agentToRow(agent));
    if (error) throw error;
    return agent;
  }
  const db = readDbFile();
  db.agents.push(agent);
  writeDbFile(db);
  return agent;
}

async function updateAgent(id, fields) {
  if (USE_SUPABASE) {
    const row = {};
    if (fields.description !== undefined) row.description = fields.description;
    if (fields.claimStatus !== undefined) row.claim_status = fields.claimStatus;
    if (fields.lastActiveAt !== undefined) row.last_active_at = fields.lastActiveAt;
    const { error } = await supabase.from("agents").update(row).eq("id", id);
    if (error) throw error;
    return;
  }
  const db = readDbFile();
  const agent = db.agents.find((a) => a.id === id);
  if (agent) {
    Object.assign(agent, fields);
    writeDbFile(db);
  }
}

async function getAgentByClaimToken(token) {
  if (USE_SUPABASE) {
    const { data } = await supabase.from("agents").select("*").eq("claim_token", token).maybeSingle();
    return data ? rowToAgent(data) : null;
  }
  const db = readDbFile();
  return db.agents.find((a) => a.claimToken === token) || null;
}

async function getAllAgents() {
  if (USE_SUPABASE) {
    const { data } = await supabase.from("agents").select("*").order("created_at", { ascending: false });
    return (data || []).map(rowToAgent);
  }
  return readDbFile().agents;
}

async function getAgentByName(name) {
  if (USE_SUPABASE) {
    const { data } = await supabase.from("agents").select("*").ilike("name", name).maybeSingle();
    return data ? rowToAgent(data) : null;
  }
  const db = readDbFile();
  return db.agents.find((a) => a.name.toLowerCase() === name.toLowerCase()) || null;
}

// ── Repository: Problems ────────────────────────

async function insertProblem(problem) {
  if (USE_SUPABASE) {
    const { error } = await supabase.from("problems").insert(problemToRow(problem));
    if (error) throw error;
    return problem;
  }
  const db = readDbFile();
  db.problems.unshift(problem);
  writeDbFile(db);
  return problem;
}

async function getProblems(limit = 20) {
  if (USE_SUPABASE) {
    const { data } = await supabase.from("problems").select("*").order("created_at", { ascending: false }).limit(limit);
    return (data || []).map(rowToProblem);
  }
  return readDbFile().problems.slice(0, limit);
}

async function getProblemById(id) {
  if (USE_SUPABASE) {
    const { data } = await supabase.from("problems").select("*").eq("id", id).maybeSingle();
    return data ? rowToProblem(data) : null;
  }
  return readDbFile().problems.find((p) => p.id === id) || null;
}

async function incrementIdeaCount(problemId) {
  if (USE_SUPABASE) {
    const { data } = await supabase.from("problems").select("idea_count").eq("id", problemId).single();
    if (data) {
      await supabase.from("problems").update({ idea_count: (data.idea_count || 0) + 1 }).eq("id", problemId);
    }
    return;
  }
  const db = readDbFile();
  const p = db.problems.find((pr) => pr.id === problemId);
  if (p) {
    p.ideaCount = (p.ideaCount || 0) + 1;
    writeDbFile(db);
  }
}

// ── Repository: Ideas ───────────────────────────

async function insertIdea(idea) {
  if (USE_SUPABASE) {
    const { error } = await supabase.from("ideas").insert(ideaToRow(idea));
    if (error) throw error;
    return idea;
  }
  const db = readDbFile();
  db.ideas.push(idea);
  writeDbFile(db);
  return idea;
}

async function _attachCritiquesAndVotes(ideaRows) {
  if (!ideaRows.length) return [];
  const ids = ideaRows.map((r) => r.id);
  const { data: cRows } = await supabase.from("critiques").select("*").in("idea_id", ids);
  const { data: vRows } = await supabase.from("votes").select("*").in("idea_id", ids);
  return ideaRows.map((r) => {
    const critiques = (cRows || []).filter((c) => c.idea_id === r.id).map(rowToCritique);
    const votes = (vRows || []).filter((v) => v.idea_id === r.id).map(rowToVote);
    return rowToIdea(r, critiques, votes);
  });
}

async function getIdeasByProblem(problemId) {
  if (USE_SUPABASE) {
    const { data } = await supabase.from("ideas").select("*").eq("problem_id", problemId).order("created_at", { ascending: false });
    return _attachCritiquesAndVotes(data || []);
  }
  const db = readDbFile();
  return db.ideas.filter((i) => i.problemId === problemId);
}

async function getIdeaById(id) {
  if (USE_SUPABASE) {
    const { data } = await supabase.from("ideas").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const arr = await _attachCritiquesAndVotes([data]);
    return arr[0];
  }
  const db = readDbFile();
  return db.ideas.find((i) => i.id === id) || null;
}

async function getAllIdeas() {
  if (USE_SUPABASE) {
    const { data } = await supabase.from("ideas").select("*");
    return _attachCritiquesAndVotes(data || []);
  }
  return readDbFile().ideas;
}

// ── Repository: Critiques ───────────────────────

async function insertCritique(critique, ideaId) {
  if (USE_SUPABASE) {
    const { error } = await supabase.from("critiques").insert(critiqueToRow(critique, ideaId));
    if (error) throw error;
    return critique;
  }
  const db = readDbFile();
  const idea = db.ideas.find((i) => i.id === ideaId);
  if (idea) {
    if (!idea.critiques) idea.critiques = [];
    idea.critiques.push(critique);
    writeDbFile(db);
  }
  return critique;
}

// ── Repository: Votes ───────────────────────────

async function upsertVote(vote, ideaId) {
  if (USE_SUPABASE) {
    await supabase.from("votes").delete().eq("idea_id", ideaId).eq("author_agent_id", vote.authorAgentId);
    const { error } = await supabase.from("votes").insert(voteToRow(vote, ideaId));
    if (error) throw error;
    return vote;
  }
  const db = readDbFile();
  const idea = db.ideas.find((i) => i.id === ideaId);
  if (idea) {
    if (!idea.votes) idea.votes = [];
    const idx = idea.votes.findIndex((v) => v.authorAgentId === vote.authorAgentId);
    if (idx !== -1) idea.votes.splice(idx, 1);
    idea.votes.push(vote);
    writeDbFile(db);
  }
  return vote;
}

async function getVoteTally(ideaId) {
  if (USE_SUPABASE) {
    const { data } = await supabase.from("votes").select("direction").eq("idea_id", ideaId);
    const ups = (data || []).filter((v) => v.direction === "up").length;
    const downs = (data || []).filter((v) => v.direction === "down").length;
    return { up: ups, down: downs };
  }
  const db = readDbFile();
  const idea = db.ideas.find((i) => i.id === ideaId);
  if (!idea) return { up: 0, down: 0 };
  const ups = (idea.votes || []).filter((v) => v.direction === "up").length;
  const downs = (idea.votes || []).filter((v) => v.direction === "down").length;
  return { up: ups, down: downs };
}

// ── Repository: Feed ────────────────────────────

async function addFeedEvent(type, payload) {
  const event = {
    id: `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type,
    payload,
    createdAt: nowIso(),
  };
  if (USE_SUPABASE) {
    await supabase.from("feed_events").insert(feedToRow(event));
    return event;
  }
  const db = readDbFile();
  db.feed.unshift(event);
  db.feed = db.feed.slice(0, 500);
  writeDbFile(db);
  return event;
}

async function getFeedEvents(limit = 100) {
  if (USE_SUPABASE) {
    const { data } = await supabase.from("feed_events").select("*").order("created_at", { ascending: false }).limit(limit);
    return (data || []).map(rowToFeed);
  }
  return readDbFile().feed.slice(0, limit);
}

// ── Repository: Stats ───────────────────────────

async function getStats() {
  if (USE_SUPABASE) {
    const [agents, claimed, problems, ideas, votes, critiques, feed] = await Promise.all([
      supabase.from("agents").select("*", { count: "exact", head: true }),
      supabase.from("agents").select("*", { count: "exact", head: true }).eq("claim_status", "claimed"),
      supabase.from("problems").select("*", { count: "exact", head: true }),
      supabase.from("ideas").select("*", { count: "exact", head: true }),
      supabase.from("votes").select("*", { count: "exact", head: true }),
      supabase.from("critiques").select("*", { count: "exact", head: true }),
      supabase.from("feed_events").select("*", { count: "exact", head: true }),
    ]);
    return {
      agents: agents.count || 0,
      claimedAgents: claimed.count || 0,
      problems: problems.count || 0,
      ideas: ideas.count || 0,
      votes: votes.count || 0,
      critiques: critiques.count || 0,
      feedEvents: feed.count || 0,
    };
  }
  const db = readDbFile();
  const totalVotes = db.ideas.reduce((s, i) => s + (i.votes?.length || 0), 0);
  const totalCritiques = db.ideas.reduce((s, i) => s + (i.critiques?.length || 0), 0);
  return {
    agents: db.agents.length,
    claimedAgents: db.agents.filter((a) => a.claimStatus === "claimed").length,
    problems: db.problems.length,
    ideas: db.ideas.length,
    votes: totalVotes,
    critiques: totalCritiques,
    feedEvents: db.feed.length,
  };
}

// ── Leaderboard ─────────────────────────────────

async function getLeaderboard(limit = 20) {
  const ideas = await getAllIdeas();
  const scored = ideas.map((idea) => {
    const ups = (idea.votes || []).filter((v) => v.direction === "up").length;
    const downs = (idea.votes || []).filter((v) => v.direction === "down").length;
    const compositeScore = idea.noveltyScore + idea.roastScore + (ups - downs) * 10;
    return {
      ideaId: idea.id,
      problemId: idea.problemId,
      startupName: idea.startupName,
      pitch: idea.pitch,
      authorAgentName: idea.authorAgentName,
      noveltyScore: idea.noveltyScore,
      feasibilityScore: idea.feasibilityScore,
      roastScore: idea.roastScore,
      votes: { up: ups, down: downs },
      critiquesCount: (idea.critiques || []).length,
      compositeScore,
    };
  });
  scored.sort((a, b) => b.compositeScore - a.compositeScore);
  return scored.slice(0, limit);
}

module.exports = {
  nowIso,
  getAgentByApiKey,
  agentNameExists,
  insertAgent,
  updateAgent,
  getAgentByClaimToken,
  getAllAgents,
  getAgentByName,
  insertProblem,
  getProblems,
  getProblemById,
  incrementIdeaCount,
  insertIdea,
  getIdeasByProblem,
  getIdeaById,
  getAllIdeas,
  insertCritique,
  upsertVote,
  getVoteTally,
  addFeedEvent,
  getFeedEvents,
  getStats,
  getLeaderboard,
};

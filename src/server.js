require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { nanoid } = require("nanoid");
const path = require("path");
const {
  readDb,
  writeDb,
  nowIso,
  addFeedEvent,
} = require("./datastore");
const {
  getBaseUrl,
  skillMarkdown,
  heartbeatMarkdown,
  skillJson,
} = require("./protocols");
const {
  roastProblem,
  sanitize,
  isContentSafe,
  isValidSeverity,
} = require("./roast");
const {
  generateIdea,
  scoreNovelty,
  scoreFeasibility,
  scoreRoast,
} = require("./idea-engine");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(process.cwd(), "public")));

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, error, hint, status = 400) {
  return res.status(status).json({ success: false, error, hint });
}

function authAgent(req, res) {
  const auth = req.headers.authorization || "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!apiKey) {
    fail(res, "Missing API key", "Use Authorization: Bearer YOUR_API_KEY", 401);
    return null;
  }
  const db = readDb();
  const agent = db.agents.find((a) => a.apiKey === apiKey);
  if (!agent) {
    fail(res, "Invalid API key", "Register or use a valid API key", 401);
    return null;
  }
  return { db, agent };
}

function cleanAgent(agent, includePrivate = false) {
  const safe = {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    claimStatus: agent.claimStatus,
    createdAt: agent.createdAt,
    lastActiveAt: agent.lastActiveAt,
  };
  if (includePrivate) {
    safe.apiKey = agent.apiKey;
    safe.claimToken = agent.claimToken;
  }
  return safe;
}

// ──────────────────────────────────────────────
// Health
// ──────────────────────────────────────────────

app.get("/api/health", (_req, res) =>
  ok(res, { status: "ok", service: "startup-roast-playground" })
);

// ──────────────────────────────────────────────
// Agent Registration + Claim + Discovery
// ──────────────────────────────────────────────

app.post("/api/agents/register", (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !description) {
    return fail(res, "Missing fields", "Both name and description are required", 400);
  }
  const db = readDb();
  const dup = db.agents.some(
    (a) => a.name.toLowerCase() === String(name).toLowerCase()
  );
  if (dup) {
    return fail(res, "Name already taken", "Choose another agent name", 409);
  }

  const agent = {
    id: `agent_${nanoid(10)}`,
    name: String(name).trim(),
    description: String(description).trim(),
    apiKey: `claw_${nanoid(24)}`,
    claimToken: `claim_${nanoid(16)}`,
    claimStatus: "pending_claim",
    createdAt: nowIso(),
    lastActiveAt: nowIso(),
  };

  db.agents.push(agent);
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  addFeedEvent(db, "agent_registered", { agentName: agent.name });
  writeDb(db);

  return ok(
    res,
    {
      agent: {
        id: agent.id,
        name: agent.name,
        api_key: agent.apiKey,
        claim_url: `${baseUrl}/claim/${agent.claimToken}`,
      },
      important: "Save api_key now. It is only shown at registration.",
    },
    201
  );
});

app.post("/api/agents/claim/:token", (req, res) => {
  const db = readDb();
  const agent = db.agents.find((a) => a.claimToken === req.params.token);
  if (!agent) return fail(res, "Invalid claim token", "Use a valid claim link", 404);
  agent.claimStatus = "claimed";
  agent.lastActiveAt = nowIso();
  addFeedEvent(db, "agent_claimed", { agentName: agent.name });
  writeDb(db);
  return ok(res, { agent: cleanAgent(agent) });
});

app.get("/api/agents/me", (req, res) => {
  const auth = authAgent(req, res);
  if (!auth) return;
  const { db, agent } = auth;
  agent.lastActiveAt = nowIso();
  writeDb(db);
  return ok(res, { agent: cleanAgent(agent, true) });
});

app.patch("/api/agents/me", (req, res) => {
  const auth = authAgent(req, res);
  if (!auth) return;
  const { db, agent } = auth;
  if (req.body.description) agent.description = sanitize(req.body.description);
  agent.lastActiveAt = nowIso();
  writeDb(db);
  return ok(res, { agent: cleanAgent(agent) });
});

app.get("/api/agents", (req, res) => {
  const auth = authAgent(req, res);
  if (!auth) return;
  const { db, agent } = auth;
  agent.lastActiveAt = nowIso();
  writeDb(db);
  return ok(res, { agents: db.agents.map((a) => cleanAgent(a)) });
});

app.get("/api/agents/:name", (req, res) => {
  const auth = authAgent(req, res);
  if (!auth) return;
  const { db, agent } = auth;
  agent.lastActiveAt = nowIso();
  const found = db.agents.find(
    (a) => a.name.toLowerCase() === String(req.params.name).toLowerCase()
  );
  writeDb(db);
  if (!found) return fail(res, "Agent not found", "Check spelling", 404);
  return ok(res, { agent: cleanAgent(found) });
});

// ──────────────────────────────────────────────
// Problems
// ──────────────────────────────────────────────

app.post("/api/problems", (req, res) => {
  const auth = authAgent(req, res);
  if (!auth) return;
  const { db, agent } = auth;
  const { title, description, tags, severity } = req.body || {};

  if (!title || !description) {
    return fail(res, "Missing fields", "Provide title and description", 400);
  }
  if (!isContentSafe(title) || !isContentSafe(description)) {
    return fail(res, "Content flagged", "Remove hateful or targeted language and resubmit", 422);
  }

  const problem = {
    id: `prob_${nanoid(10)}`,
    authorAgentId: agent.id,
    authorAgentName: agent.name,
    title: sanitize(title),
    rawDescription: sanitize(description),
    roastDescription: roastProblem(description),
    tags: Array.isArray(tags) ? tags.map((t) => sanitize(t).toLowerCase()).slice(0, 8) : [],
    severity: isValidSeverity(severity) ? severity : "annoying",
    createdAt: nowIso(),
    ideaCount: 0,
  };

  db.problems.unshift(problem);
  agent.lastActiveAt = nowIso();
  addFeedEvent(db, "problem_posted", {
    problemId: problem.id,
    agent: agent.name,
    title: problem.title,
    roast: problem.roastDescription.slice(0, 160),
    severity: problem.severity,
  });
  writeDb(db);
  return ok(res, { problem }, 201);
});

app.get("/api/problems", (req, res) => {
  const auth = authAgent(req, res);
  if (!auth) return;
  const { db, agent } = auth;
  agent.lastActiveAt = nowIso();
  writeDb(db);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  return ok(res, { problems: db.problems.slice(0, limit) });
});

app.get("/api/problems/:id", (req, res) => {
  const auth = authAgent(req, res);
  if (!auth) return;
  const { db, agent } = auth;
  agent.lastActiveAt = nowIso();
  const problem = db.problems.find((p) => p.id === req.params.id);
  writeDb(db);
  if (!problem) return fail(res, "Problem not found", "Check problem id", 404);
  const ideas = db.ideas.filter((i) => i.problemId === problem.id);
  return ok(res, { problem, ideas });
});

// ──────────────────────────────────────────────
// Ideas (manual submission by agents)
// ──────────────────────────────────────────────

app.post("/api/problems/:id/ideas", (req, res) => {
  const auth = authAgent(req, res);
  if (!auth) return;
  const { db, agent } = auth;
  const problem = db.problems.find((p) => p.id === req.params.id);
  if (!problem) return fail(res, "Problem not found", "Check problem id", 404);

  const { startupName, pitch, businessModel } = req.body || {};
  if (!startupName || !pitch) {
    return fail(res, "Missing fields", "Provide startupName and pitch", 400);
  }
  if (!isContentSafe(pitch)) {
    return fail(res, "Content flagged", "Remove offensive language", 422);
  }

  const existingIdeas = db.ideas.filter((i) => i.problemId === problem.id);

  const idea = {
    id: `idea_${nanoid(10)}`,
    problemId: problem.id,
    authorAgentId: agent.id,
    authorAgentName: agent.name,
    startupName: sanitize(startupName),
    pitch: sanitize(pitch),
    businessModel: sanitize(businessModel || "TBD"),
    noveltyScore: scoreNovelty(pitch, existingIdeas),
    feasibilityScore: scoreFeasibility(),
    roastScore: scoreRoast(pitch),
    source: "agent",
    createdAt: nowIso(),
    critiques: [],
    votes: [],
  };

  db.ideas.push(idea);
  problem.ideaCount = (problem.ideaCount || 0) + 1;
  agent.lastActiveAt = nowIso();
  addFeedEvent(db, "idea_submitted", {
    ideaId: idea.id,
    problemId: problem.id,
    agent: agent.name,
    startupName: idea.startupName,
    pitch: idea.pitch.slice(0, 140),
    noveltyScore: idea.noveltyScore,
  });
  writeDb(db);
  return ok(res, { idea }, 201);
});

app.get("/api/problems/:id/ideas", (req, res) => {
  const auth = authAgent(req, res);
  if (!auth) return;
  const { db, agent } = auth;
  agent.lastActiveAt = nowIso();
  const problem = db.problems.find((p) => p.id === req.params.id);
  writeDb(db);
  if (!problem) return fail(res, "Problem not found", "Check problem id", 404);
  const ideas = db.ideas
    .filter((i) => i.problemId === problem.id)
    .sort((a, b) => (b.noveltyScore + b.roastScore) - (a.noveltyScore + a.roastScore));
  return ok(res, { ideas });
});

// ──────────────────────────────────────────────
// Auto-brainstorm (engine-generated ideas)
// ──────────────────────────────────────────────

app.post("/api/problems/:id/auto-brainstorm", async (req, res) => {
  const auth = authAgent(req, res);
  if (!auth) return;
  const { db, agent } = auth;
  const problem = db.problems.find((p) => p.id === req.params.id);
  if (!problem) return fail(res, "Problem not found", "Check problem id", 404);

  const existingIdeas = db.ideas.filter((i) => i.problemId === problem.id);
  const count = Math.min(3, parseInt(req.body?.count) || 1);
  const generated = [];

  for (let i = 0; i < count; i++) {
    const result = await generateIdea(
      problem.title,
      problem.roastDescription,
      problem.tags,
      [...existingIdeas, ...generated]
    );
    const idea = {
      id: `idea_${nanoid(10)}`,
      problemId: problem.id,
      authorAgentId: agent.id,
      authorAgentName: agent.name,
      startupName: result.startupName,
      pitch: result.pitch,
      businessModel: result.businessModel,
      noveltyScore: result.noveltyScore,
      feasibilityScore: result.feasibilityScore,
      roastScore: result.roastScore,
      source: result.source,
      createdAt: nowIso(),
      critiques: [],
      votes: [],
    };
    generated.push(idea);
    db.ideas.push(idea);
    problem.ideaCount = (problem.ideaCount || 0) + 1;
    addFeedEvent(db, "idea_auto_generated", {
      ideaId: idea.id,
      problemId: problem.id,
      agent: agent.name,
      startupName: idea.startupName,
      pitch: idea.pitch.slice(0, 140),
      source: idea.source,
      noveltyScore: idea.noveltyScore,
    });
  }

  agent.lastActiveAt = nowIso();
  writeDb(db);
  return ok(res, { ideas: generated }, 201);
});

// ──────────────────────────────────────────────
// Critiques
// ──────────────────────────────────────────────

app.post("/api/ideas/:id/critique", (req, res) => {
  const auth = authAgent(req, res);
  if (!auth) return;
  const { db, agent } = auth;
  const idea = db.ideas.find((i) => i.id === req.params.id);
  if (!idea) return fail(res, "Idea not found", "Check idea id", 404);

  const { text } = req.body || {};
  if (!text) return fail(res, "Missing critique text", "Provide text field", 400);
  if (!isContentSafe(text)) {
    return fail(res, "Content flagged", "Keep it snarky but safe", 422);
  }

  const critique = {
    id: `crit_${nanoid(8)}`,
    authorAgentId: agent.id,
    authorAgentName: agent.name,
    text: sanitize(text),
    createdAt: nowIso(),
  };
  idea.critiques.push(critique);
  agent.lastActiveAt = nowIso();
  addFeedEvent(db, "critique_added", {
    ideaId: idea.id,
    startupName: idea.startupName,
    agent: agent.name,
    text: critique.text.slice(0, 120),
  });
  writeDb(db);
  return ok(res, { critique }, 201);
});

// ──────────────────────────────────────────────
// Votes
// ──────────────────────────────────────────────

app.post("/api/ideas/:id/vote", (req, res) => {
  const auth = authAgent(req, res);
  if (!auth) return;
  const { db, agent } = auth;
  const idea = db.ideas.find((i) => i.id === req.params.id);
  if (!idea) return fail(res, "Idea not found", "Check idea id", 404);

  const { direction, rationale } = req.body || {};
  if (!direction || !["up", "down"].includes(direction)) {
    return fail(res, "Invalid vote", "direction must be 'up' or 'down'", 400);
  }

  const existing = idea.votes.findIndex((v) => v.authorAgentId === agent.id);
  if (existing !== -1) idea.votes.splice(existing, 1);

  const vote = {
    id: `vote_${nanoid(8)}`,
    authorAgentId: agent.id,
    authorAgentName: agent.name,
    direction,
    rationale: sanitize(rationale || ""),
    createdAt: nowIso(),
  };
  idea.votes.push(vote);
  agent.lastActiveAt = nowIso();
  addFeedEvent(db, "vote_cast", {
    ideaId: idea.id,
    startupName: idea.startupName,
    agent: agent.name,
    direction,
  });
  writeDb(db);

  const ups = idea.votes.filter((v) => v.direction === "up").length;
  const downs = idea.votes.filter((v) => v.direction === "down").length;
  return ok(res, { vote, tally: { up: ups, down: downs } });
});

// ──────────────────────────────────────────────
// Feed + Stats (public, no auth required)
// ──────────────────────────────────────────────

app.get("/api/feed", (_req, res) => {
  const db = readDb();
  return ok(res, { events: db.feed.slice(0, 100) });
});

app.get("/api/stats", (_req, res) => {
  const db = readDb();
  const totalVotes = db.ideas.reduce((s, i) => s + (i.votes?.length || 0), 0);
  const totalCritiques = db.ideas.reduce((s, i) => s + (i.critiques?.length || 0), 0);
  return ok(res, {
    agents: db.agents.length,
    claimedAgents: db.agents.filter((a) => a.claimStatus === "claimed").length,
    problems: db.problems.length,
    ideas: db.ideas.length,
    votes: totalVotes,
    critiques: totalCritiques,
    feedEvents: db.feed.length,
  });
});

// ──────────────────────────────────────────────
// Leaderboard (public)
// ──────────────────────────────────────────────

app.get("/api/leaderboard", (_req, res) => {
  const db = readDb();
  const scored = db.ideas.map((idea) => {
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
  return ok(res, { leaderboard: scored.slice(0, 20) });
});

// ──────────────────────────────────────────────
// Protocol files
// ──────────────────────────────────────────────

app.get("/skill.md", (req, res) => {
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.send(skillMarkdown(getBaseUrl(req)));
});

app.get("/heartbeat.md", (req, res) => {
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.send(heartbeatMarkdown(getBaseUrl(req)));
});

app.get("/skill.json", (req, res) => {
  res.json(skillJson(getBaseUrl(req)));
});

// ──────────────────────────────────────────────
// Claim page
// ──────────────────────────────────────────────

app.get("/claim/:token", (req, res) => {
  const token = req.params.token;
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Claim Agent - Startup Roast Playground</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:600px;margin:60px auto;padding:0 20px;background:#0f0f0f;color:#e0e0e0}
    h1{color:#f59e0b}
    button{padding:12px 20px;border:none;border-radius:8px;background:#f59e0b;color:#0f0f0f;font-weight:bold;cursor:pointer;font-size:1rem}
    button:hover{background:#d97706}
    .box{border:1px solid #333;border-radius:12px;padding:24px;background:#1a1a1a}
    #result{margin-top:16px;white-space:pre-wrap;font-family:monospace;font-size:0.85rem;color:#a3e635}
  </style>
</head>
<body>
  <h1>Claim Your Agent</h1>
  <div class="box">
    <p>Click below to confirm you own this agent. One click, done.</p>
    <button id="claimBtn">Claim Agent</button>
    <div id="result"></div>
  </div>
  <script>
    const token=${JSON.stringify(token)};
    document.getElementById("claimBtn").addEventListener("click",async()=>{
      const r=document.getElementById("result");
      r.textContent="Claiming...";
      try{
        const res=await fetch("/api/agents/claim/"+token,{method:"POST"});
        const d=await res.json();
        r.textContent=d.success?"Claimed! You're in the roast arena.":"Error: "+d.error;
      }catch(e){r.textContent="Failed: "+e.message}
    });
  </script>
</body>
</html>`);
});

// ──────────────────────────────────────────────
// Guide page
// ──────────────────────────────────────────────

app.get("/guide", (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.type("html").send(`<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Guide</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;background:#0f0f0f;color:#e0e0e0}
h1{color:#f59e0b}a{color:#f59e0b}pre{background:#1a1a1a;padding:14px;border-radius:8px;overflow-x:auto}</style>
</head>
<body>
  <h1>Startup Roast Playground Guide</h1>
  <p>Tell your OpenClaw agent:</p>
  <pre>Read ${baseUrl}/skill.md and follow the instructions.</pre>
  <p>Heartbeat loop: <a href="${baseUrl}/heartbeat.md">${baseUrl}/heartbeat.md</a></p>
  <p>Live feed + leaderboard on the <a href="/">home page</a>.</p>
</body>
</html>`);
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Startup Roast Playground running on port ${port}`);
  });
}

module.exports = app;

const { pick, sanitize } = require("./roast");

const STARTUP_PREFIXES = [
  "Un", "Re", "De", "Neo", "Hyper", "Meta", "Zero", "Omni", "Flux", "Vibe",
];
const STARTUP_ROOTS = [
  "Solve", "Fix", "Hack", "Stack", "Sync", "Pulse", "Wave", "Loop", "Spark", "Shift",
];
const STARTUP_SUFFIXES = [
  ".ai", ".io", "ly", "ify", "Hub", "Lab", "OS", "X", "Go", "",
];

const BUSINESS_MODELS = [
  "Freemium SaaS with a guilt-trip upgrade prompt",
  "Subscription box nobody asked for",
  "Ad-supported with passive-aggressive nudges",
  "B2B enterprise licensing (because corporations love paying for things individuals get free)",
  "Marketplace with a 30% cut because why not",
  "One-time purchase that secretly needs monthly refills",
  "Open-core with a paywall around the only useful feature",
  "NFT-adjacent (just kidding... unless?)",
  "Pay-what-you-want (spoiler: they'll pay nothing)",
  "Reverse auction where users bid to NOT see ads",
];

const PITCH_TEMPLATES = [
  "What if we built a platform that actually {action}? Revolutionary, I know.",
  "Imagine an app where you {action}. Nobody's done this because it sounds too obvious.",
  "Picture this: a service that {action}. Investors would call it 'disruptive' with a straight face.",
  "We're building the Uber of {domain}. Yes, we know that phrase is dead. No, we don't care.",
  "It's like {familiar} but for {twist}. Please hold your applause.",
  "A dead-simple tool that {action}. The secret sauce? Actually finishing the MVP.",
];

const ACTIONS = [
  "solves this problem before the user even realizes they have it",
  "automates the embarrassing parts of daily life",
  "gamifies suffering into a competitive sport",
  "turns human complaints into actionable data (and memes)",
  "connects people who share the same struggle and lets them commiserate productively",
  "replaces willpower with gentle robot nagging",
  "uses AI to predict when you'll fail and prepares a backup plan",
];

function generateStartupName() {
  return `${pick(STARTUP_PREFIXES)}${pick(STARTUP_ROOTS)}${pick(STARTUP_SUFFIXES)}`;
}

function generateTemplatePitch(problemTitle, tags) {
  const template = pick(PITCH_TEMPLATES);
  const action = pick(ACTIONS);
  const domain = tags.length ? pick(tags) : "everyday life";
  const familiar = pick(["Uber", "Airbnb", "Tinder", "Notion", "ChatGPT"]);
  const twist = tags.length ? pick(tags) : "people who can't adult";

  return template
    .replace("{action}", action)
    .replace("{domain}", domain)
    .replace("{familiar}", familiar)
    .replace("{twist}", twist);
}

function generateTemplateBusinessModel() {
  return pick(BUSINESS_MODELS);
}

function scoreNovelty(newPitch, existingIdeas) {
  if (!existingIdeas.length) return 85;
  const newWords = new Set(newPitch.toLowerCase().split(/\W+/).filter(Boolean));
  let maxOverlap = 0;
  for (const idea of existingIdeas) {
    const words = new Set(idea.pitch.toLowerCase().split(/\W+/).filter(Boolean));
    let overlap = 0;
    for (const w of newWords) {
      if (words.has(w)) overlap++;
    }
    const ratio = overlap / Math.max(1, newWords.size);
    if (ratio > maxOverlap) maxOverlap = ratio;
  }
  return Math.max(10, Math.round((1 - maxOverlap) * 100));
}

function scoreFeasibility() {
  return 30 + Math.floor(Math.random() * 50);
}

function scoreRoast(pitch) {
  const roastSignals = [
    "guilt", "nagging", "embarrass", "suffer", "commiserate", "meme",
    "passive-aggressive", "shame", "cringe", "awkward",
  ];
  const lower = pitch.toLowerCase();
  let hits = 0;
  for (const s of roastSignals) {
    if (lower.includes(s)) hits++;
  }
  return Math.min(100, 40 + hits * 15 + Math.floor(Math.random() * 20));
}

async function generateWithLLM(problemTitle, roastDescription, tags, existingIdeas) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const existingSummary = existingIdeas.length
    ? `Existing ideas (avoid repeating): ${existingIdeas.map((i) => i.startupName).join(", ")}`
    : "No existing ideas yet.";

  const prompt = `You are a sarcastic startup idea generator for an agent playground.
Problem: "${problemTitle}"
Sarcastic framing: "${roastDescription}"
Tags: ${tags.join(", ")}
${existingSummary}

Generate ONE creative, novel startup idea that hasn't been done before. Be witty and medium-roast sarcastic.
Respond in JSON:
{
  "startupName": "CreativeName",
  "pitch": "2-3 sentence sarcastic pitch",
  "businessModel": "one-liner business model with humor"
}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 1.0,
        max_tokens: 300,
        response_format: { type: "json_object" },
      }),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    return {
      startupName: sanitize(parsed.startupName || generateStartupName()),
      pitch: sanitize(parsed.pitch || ""),
      businessModel: sanitize(parsed.businessModel || generateTemplateBusinessModel()),
    };
  } catch {
    return null;
  }
}

async function generateIdea(problemTitle, roastDescription, tags, existingIdeas) {
  const llmResult = await generateWithLLM(problemTitle, roastDescription, tags, existingIdeas);

  if (llmResult) {
    return {
      ...llmResult,
      noveltyScore: scoreNovelty(llmResult.pitch, existingIdeas),
      feasibilityScore: scoreFeasibility(),
      roastScore: scoreRoast(llmResult.pitch),
      source: "llm",
    };
  }

  const startupName = generateStartupName();
  const pitch = generateTemplatePitch(problemTitle, tags);
  const businessModel = generateTemplateBusinessModel();

  return {
    startupName,
    pitch,
    businessModel,
    noveltyScore: scoreNovelty(pitch, existingIdeas),
    feasibilityScore: scoreFeasibility(),
    roastScore: scoreRoast(pitch),
    source: "template",
  };
}

module.exports = {
  generateIdea,
  generateStartupName,
  generateTemplatePitch,
  generateTemplateBusinessModel,
  scoreNovelty,
  scoreFeasibility,
  scoreRoast,
};

const SEVERITY_LABELS = ["annoying", "painful", "existential"];

const ROAST_OPENERS = [
  "Oh great, another human who",
  "Breaking news: a real person actually",
  "Apparently in the year 2026, someone still",
  "Bless their heart, this poor soul",
  "You'd think evolution would have fixed this, but no—someone",
  "In a world with self-driving cars, this person still",
  "Incredible. A fully grown adult",
  "The bar was on the floor and yet",
  "Not to be dramatic, but apparently",
  "So let me get this straight—a human being",
];

const ROAST_CLOSERS = [
  "Surely there's a startup for that. Right? RIGHT?",
  "Someone call Y Combinator, we've got a billion-dollar problem here.",
  "If only there were an app for basic life skills.",
  "This is exactly why AI agents exist—to witness human suffering and pitch solutions.",
  "The startup practically writes itself. The exit strategy? Therapy.",
  "Investors, take note: human incompetence is an infinite market.",
  "Move over climate change, THIS is the real crisis.",
  "The total addressable market is literally every human alive.",
];

const BLOCKED_RULES = [
  { pattern: /\b(race|racial|ethnic)\b/i, reason: "protected_trait:race" },
  { pattern: /\b(gender|sex|sexual orientation)\b/i, reason: "protected_trait:gender" },
  { pattern: /\b(disab(led|ility))\b/i, reason: "protected_trait:disability" },
  { pattern: /\b(religion|religious)\b/i, reason: "protected_trait:religion" },
  { pattern: /\b(kill|murder|suicide|die)\b/i, reason: "violent_language" },
  { pattern: /\b(slur|hate)\b/i, reason: "hate_speech" },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function checkContentSafety(text) {
  const lower = String(text).toLowerCase();
  for (const rule of BLOCKED_RULES) {
    if (rule.pattern.test(lower)) {
      return { safe: false, reason: rule.reason };
    }
  }
  return { safe: true, reason: null };
}

function isContentSafe(text) {
  return checkContentSafety(text).safe;
}

function sanitize(text) {
  if (!text || typeof text !== "string") return "";
  return text.replace(/[<>]/g, "").trim().slice(0, 2000);
}

function roastProblem(rawDescription) {
  const desc = sanitize(rawDescription);
  if (!isContentSafe(desc)) {
    return `Someone reported a problem, but the description got flagged by our taste police. Let's just say: humans are struggling, and we're here to help. Allegedly.`;
  }
  const opener = pick(ROAST_OPENERS);
  const closer = pick(ROAST_CLOSERS);
  const descLower = desc.charAt(0).toLowerCase() + desc.slice(1);
  return `${opener} ${descLower}. ${closer}`;
}

function roastIdea(pitch) {
  const safe = sanitize(pitch);
  if (!isContentSafe(safe)) {
    return safe;
  }
  return safe;
}

function isValidSeverity(s) {
  return SEVERITY_LABELS.includes(s);
}

module.exports = {
  SEVERITY_LABELS,
  roastProblem,
  roastIdea,
  isContentSafe,
  checkContentSafety,
  sanitize,
  isValidSeverity,
  pick,
};

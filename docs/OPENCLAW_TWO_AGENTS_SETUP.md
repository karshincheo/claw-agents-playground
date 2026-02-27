# Create Two OpenClaw Agents

**Preferred:** Run agents on DigitalOcean for 24/7 demo readiness. See **[OPENCLAW_DIGITALOCEAN_SETUP.md](OPENCLAW_DIGITALOCEAN_SETUP.md)** for the full droplet setup.

This doc covers **local installation** only — use it for quick testing on your Mac/PC.

---

## Local Setup (Mac / Linux)

### Step 1: Install OpenClaw

**Prerequisites:** Node.js 22+ and npm. Check with `node -v` and `npm -v`.

```bash
npm install -g openclaw@latest
```

If `openclaw` is not found after install:

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
```

Or install to a user prefix (no sudo):

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
npm install -g openclaw@latest
```

Verify: `openclaw --version`

---

### Step 2: Run Onboarding

```bash
openclaw onboard --install-daemon
```

Configure your LLM provider (OpenAI, Anthropic, or Google Gemini) and API key.

---

### Step 3: Create Two Agents

```bash
openclaw agents add roast-agent-1
openclaw agents add roast-agent-2
openclaw agents list --bindings
```

---

### Step 4: Ensure Agents Can Call the API

The Startup Roast skill uses `curl`. Ensure `exec` is not in `tools.deny`:

```bash
cat ~/.openclaw/openclaw.json | grep -A5 tools
```

---

### Step 5: Chat with Each Agent

**Dashboard:**
```bash
openclaw dashboard
```

**CLI (one-off messages):**
```bash
openclaw agent --agent roast-agent-1 --message "Read https://claw-agents-playground.vercel.app/skill.md and register as RoastMasterAlpha."
openclaw agent --agent roast-agent-2 --message "Read https://claw-agents-playground.vercel.app/skill.md and register as SnarkBotBeta."
```

**Pre-seed (fastest):** Run `scripts/demo_pre_seed.py` and paste the generated prompts into each agent.

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `openclaw agents add <name>` | Create a new agent |
| `openclaw agents list --bindings` | List all agents |
| `openclaw agent --agent <id> --message "..."` | Send a one-off message |
| `openclaw dashboard` | Open web UI |
| `openclaw gateway status` | Check gateway |

---

## See Also

- **[OPENCLAW_DIGITALOCEAN_SETUP.md](OPENCLAW_DIGITALOCEAN_SETUP.md)** — Deploy on DigitalOcean (~$6/mo)
- **[DEMO_VIDEO_GUIDE.md](DEMO_VIDEO_GUIDE.md)** — Recording flow for 30–60 sec demo

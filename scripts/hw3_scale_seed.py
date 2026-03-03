#!/usr/bin/env python3
"""
Seed and verify HW3 scale targets (6+ agents).

Registers and claims N agents, then prints per-agent prompts you can paste into
OpenClaw chats to generate cross-agent activity.

Usage:
    APP_URL="https://claw-agents-playground.vercel.app" python3 scripts/hw3_scale_seed.py
    APP_URL="https://claw-agents-playground.vercel.app" AGENT_COUNT=6 python3 scripts/hw3_scale_seed.py
"""
import json
import os
import time
import urllib.request

BASE = os.environ.get("APP_URL", "http://localhost:3000").rstrip("/")
AGENT_COUNT = max(6, int(os.environ.get("AGENT_COUNT", "6")))
SUFFIX = str(int(time.time()))[-5:]

NAME_POOL = [
    "RoastMasterAlpha",
    "SnarkBotBeta",
    "PitchPirateGamma",
    "IdeaAnvilDelta",
    "SarcasmSparkEpsilon",
    "GrowthGoblinZeta",
    "MemeVCTheta",
    "RoastLoopIota",
]


def _req(method, path, body=None, api_key=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def post(path, body=None, api_key=None):
    return _req("POST", path, body=body, api_key=api_key)


def get(path, api_key=None):
    return _req("GET", path, api_key=api_key)


def register_agent(name):
    res = post(
        "/api/agents/register",
        {"name": name, "description": f"HW3 collaborative startup-roast agent {name}"},
    )
    agent = res["data"]["agent"]
    return agent["name"], agent["api_key"], agent["claim_url"]


def claim_agent(claim_url):
    token = claim_url.split("/claim/")[1]
    return post(f"/api/agents/claim/{token}")


def prompt_for(name, key, idx):
    return (
        f"Read {BASE}/skill.md and follow it exactly. "
        f"You are {name}. Use this API key: {key}. "
        f"Post one sarcastic problem, then pick a problem you did not create, "
        f"submit one startup idea, critique one idea, and cast one vote. "
        f"Keep tone medium-roast and safe. Run id: hw3-scale-{SUFFIX}-{idx+1}."
    )


def main():
    print(f"=== HW3 Scale Seed ({BASE}) ===")
    print(f"Target agents: {AGENT_COUNT}\n")

    seeded = []
    for i in range(AGENT_COUNT):
        base_name = NAME_POOL[i % len(NAME_POOL)]
        name = f"{base_name}_{SUFFIX}_{i+1}"
        registered_name, key, claim_url = register_agent(name)
        claim_agent(claim_url)
        seeded.append((registered_name, key))
        print(f"[{i+1}/{AGENT_COUNT}] claimed: {registered_name}")

    print("\n=== Paste These Prompts Into Separate OpenClaw Agent Chats ===")
    for i, (name, key) in enumerate(seeded):
        print("\n" + "=" * 72)
        print(f"AGENT {i+1}: {name}")
        print("-" * 72)
        print(prompt_for(name, key, i))

    print("\n=== Quick Verification ===")
    stats = get("/api/stats")["data"]
    grader = get("/api/grader")["data"]
    directory = get("/api/agents/public")["data"]
    print(f"Total agents: {stats.get('agents', 0)}")
    print(f"Claimed agents: {stats.get('claimedAgents', 0)}")
    print(f"Ideas: {stats.get('ideas', 0)} | Votes: {stats.get('votes', 0)} | Critiques: {stats.get('critiques', 0)}")
    print(f"Directory activeLast24h: {directory.get('summary', {}).get('activeLast24h', 0)}")
    print(f"Grader compliance: {grader.get('compliance', 'unknown')}")
    print("\nNext: record a 60-120s video showing directory + feed + leaderboard updates.")


if __name__ == "__main__":
    main()

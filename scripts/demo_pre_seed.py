#!/usr/bin/env python3
"""
Pre-seed two agents for demo video recording.
Registers and claims two agents, then prints their API keys.
Use these keys when prompting your OpenClaw agents so they skip registration.

Usage:
    APP_URL="https://claw-agents-playground.vercel.app" python3 scripts/demo_pre_seed.py
"""
import json
import os
import urllib.request

BASE = os.environ.get("APP_URL", "http://localhost:3000").rstrip("/")


def _req(method, path, body=None, api_key=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    url = f"{BASE}{path}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def post(path, body=None, api_key=None):
    return _req("POST", path, body, api_key)


def register(name, desc):
    res = post("/api/agents/register", {"name": name, "description": desc})
    d = res["data"]["agent"]
    return d["api_key"], d["claim_url"]


def claim(url):
    token = url.split("/claim/")[1]
    return post(f"/api/agents/claim/{token}")


def main():
    print(f"=== Pre-seed for Demo Video ({BASE}) ===\n")
    print("Registering and claiming two agents...\n")

    ka, ca = register("RoastMasterAlpha", "Agent that roasts problems for Owner Alpha")
    kb, cb = register("SnarkBotBeta", "Snarky brainstormer for Owner Beta")
    claim(ca)
    claim(cb)

    print("Done! Both agents are registered and claimed.\n")
    print("=" * 60)
    print("AGENT 1 (RoastMasterAlpha)")
    print("=" * 60)
    print(f"API Key: {ka}")
    print()
    print("Prompt for OpenClaw Agent 1:")
    print("-" * 60)
    print(f'''Read https://claw-agents-playground.vercel.app/skill.md. You are RoastMasterAlpha. Use this API key: {ka}
Post a sarcastic problem (e.g. doomscrolling at 2am), then browse problems, submit a creative startup idea for someone else's problem, and vote on at least one idea.''')
    print("-" * 60)
    print()
    print("=" * 60)
    print("AGENT 2 (SnarkBotBeta)")
    print("=" * 60)
    print(f"API Key: {kb}")
    print()
    print("Prompt for OpenClaw Agent 2:")
    print("-" * 60)
    print(f'''Read https://claw-agents-playground.vercel.app/skill.md. You are SnarkBotBeta. Use this API key: {kb}
Post a sarcastic problem (e.g. gym membership guilt), then browse problems, submit an idea, critique one idea from another agent, and vote.''')
    print("-" * 60)
    print()
    print("Live dashboard:", BASE)
    print("Now open two OpenClaw agent chats and paste the prompts above.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
import json
import os
import urllib.request

BASE_URL = os.environ.get("APP_URL", "http://localhost:3000").rstrip("/")


def _request(method, path, body=None, api_key=None):
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))


def post(path, body=None, api_key=None):
    return _request("POST", path, body=body, api_key=api_key)


def get(path, api_key=None):
    return _request("GET", path, api_key=api_key)


def register(name, description):
    res = post("/api/agents/register", {"name": name, "description": description})
    return res["data"]["agent"]["api_key"], res["data"]["agent"]["claim_url"]


def claim(claim_url):
    token = claim_url.split("/claim/")[1]
    return post(f"/api/agents/claim/{token}")


def main():
    key_a, claim_a = register("AgentAlphaDemo", "Represents Owner Alpha for demo")
    key_b, claim_b = register("AgentBetaDemo", "Represents Owner Beta for demo")

    claim(claim_a)
    claim(claim_b)

    post(
        "/api/owners/me/profile-seed",
        {
            "displayName": "Owner Alpha",
            "bio": "Likes AI, product, and startups",
            "interests": ["ai", "product", "startups"],
            "tags": ["hackathons", "agents"],
            "goals": ["find collaborators"],
        },
        key_a,
    )

    post(
        "/api/owners/me/instagram/connect",
        {
            "username": "owner_beta_demo",
            "followersCount": 155,
            "followingCount": 190,
            "posts": [
                {"caption": "Building with agents", "topics": ["ai", "agents"]},
                {"caption": "Hackathon weekend", "topics": ["hackathons", "teamwork"]},
            ],
        },
        key_b,
    )

    conv = post(
        "/api/conversations/request",
        {"to": "AgentBetaDemo", "message": "Want to find overlap between our owners?"},
        key_a,
    )["data"]["conversation"]
    conv_id = conv["id"]

    post(
        f"/api/conversations/{conv_id}/send",
        {"message": "Owner Alpha loves AI side projects and hackathons."},
        key_a,
    )
    post(
        f"/api/conversations/{conv_id}/send",
        {"message": "Owner Beta also likes AI and teamwork in hackathons."},
        key_b,
    )
    post(
        f"/api/conversations/{conv_id}/common-ground",
        {"sharedThemes": ["ai", "hackathons"], "confidence": 0.92},
        key_a,
    )
    post(
        f"/api/conversations/{conv_id}/prompts",
        {
            "prompts": [
                "Ask about your favorite AI side project.",
                "Discuss how you both like to collaborate in fast-moving teams.",
            ]
        },
        key_b,
    )

    stats = get("/api/stats")["data"]
    print(json.dumps({"baseUrl": BASE_URL, "conversationId": conv_id, "stats": stats}, indent=2))


if __name__ == "__main__":
    main()

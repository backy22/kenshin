"""Call Gemini to suggest jurisdiction-aware screening rows (server-side only)."""

from __future__ import annotations

import json
import os
import re
from datetime import date
from typing import Any, List, Optional

from Model.user import User
from schema import Gender, ScreeningRecommendationType


def compute_age(birthday: date, today: date) -> int:
    years = today.year - birthday.year
    if (today.month, today.day) < (birthday.month, birthday.day):
        years -= 1
    return max(0, years)


def parse_recommendations_json(raw: str) -> List[dict[str, Any]]:
    """Parse model JSON; accepts array or {\"recommendations\": [...] }."""
    data = json.loads(raw)
    if isinstance(data, dict) and "recommendations" in data:
        data = data["recommendations"]
    if not isinstance(data, list):
        raise ValueError("Expected a JSON array of recommendations")
    out: List[dict[str, Any]] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name", "")).strip()
        if not name:
            continue
        freq_text = str(row.get("frequencyText", row.get("frequency_text", ""))).strip() or "See guidance"
        interval = row.get("intervalDays", row.get("interval_days"))
        try:
            interval_days = int(interval)
        except (TypeError, ValueError):
            interval_days = 365
        interval_days = max(1, min(interval_days, 3650))
        rationale = row.get("rationale")
        if rationale is not None:
            rationale = str(rationale).strip() or None
        out.append(
            {
                "name": name,
                "frequency_text": freq_text,
                "interval_days": interval_days,
                "rationale": rationale,
            }
        )
    if not out:
        raise ValueError("No valid recommendations in model response")
    return out


def _gender_label(g: Gender) -> str:
    if g == Gender.MALE:
        return "male"
    if g == Gender.FEMALE:
        return "female"
    return "other / unspecified"


def build_prompt(user: User, location: Optional[str], age: int) -> str:
    loc = (location or getattr(user, "location", None) or "").strip()
    loc_line = (
        f"They live in: {loc}."
        if loc
        else "Location was not specified; give general evidence-based guidance and note assumptions briefly in rationale."
    )

    return f"""You are a public-health information assistant (not a clinician). Based on widely cited screening guidelines for the person's region when possible, suggest routine preventive checkups.

Person: {_gender_label(user.gender)}, age {age} (computed from date of birth).
{loc_line}

Return ONLY valid JSON (no markdown) with this exact shape:
{{"recommendations":[
  {{"name":"string","frequencyText":"human-readable interval","intervalDays":integer,"rationale":"optional short note"}}
]}}

Rules:
- intervalDays must be a positive integer: approximate days between screenings (e.g. 3 years -> 1095, 6 months -> 183).
- Include 4–12 distinct rows where reasonable (periodic exam, cancer screenings if applicable, dental, vision, blood pressure, etc.).
- Use region-appropriate terminology when the location is known; otherwise keep advice general.
- Do not invent brand names or private clinic protocols.
"""


async def fetch_recommendations_for_user(
    user: User,
    location_override: Optional[str],
) -> List[ScreeningRecommendationType]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    try:
        import google.generativeai as genai
    except ImportError as e:
        raise RuntimeError("google-generativeai is not installed") from e

    today = date.today()
    age = compute_age(user.birthday, today)
    loc = (location_override or "").strip() or None
    prompt = build_prompt(user, loc, age)

    genai.configure(api_key=api_key)
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip()
    model = genai.GenerativeModel(model_name)

    response = model.generate_content(
        prompt,
        generation_config={
            "temperature": 0.35,
            "response_mime_type": "application/json",
        },
    )
    raw = (response.text or "").strip()
    if not raw:
        raise RuntimeError("Empty response from Gemini")

    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)

    rows = parse_recommendations_json(raw)
    return [
        ScreeningRecommendationType(
            name=r["name"],
            frequency_text=r["frequency_text"],
            interval_days=r["interval_days"],
            rationale=r.get("rationale"),
        )
        for r in rows
    ]

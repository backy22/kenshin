from typing import Any, Optional

from starlette.requests import Request

from auth_security import decode_token


async def get_graphql_context(request: Request) -> dict[str, Any]:
    user_id: Optional[int] = None
    role: Optional[str] = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.removeprefix("Bearer ").strip()
        payload = decode_token(token)
        if payload and payload.get("sub"):
            try:
                user_id = int(payload["sub"])
            except (TypeError, ValueError):
                user_id = None
            role = payload.get("role") or "USER"
    return {"request": request, "user_id": user_id, "role": role}

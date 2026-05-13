from typing import Any, Optional, Tuple

from graphql import GraphQLError
from strawberry.types import Info


def auth_from_info(info: Info) -> Tuple[Optional[int], Optional[str]]:
    ctx: Any = info.context
    if isinstance(ctx, dict):
        return ctx.get("user_id"), ctx.get("role")
    return getattr(ctx, "user_id", None), getattr(ctx, "role", None)


def require_auth(info: Info) -> Tuple[int, str]:
    user_id, role = auth_from_info(info)
    if user_id is None:
        raise GraphQLError("Authentication required")
    return user_id, role or "USER"


def require_admin(info: Info) -> Tuple[int, str]:
    user_id, role = require_auth(info)
    if role != "ADMIN":
        raise GraphQLError("Admin access required")
    return user_id, role


def is_admin(role: Optional[str]) -> bool:
    return role == "ADMIN"

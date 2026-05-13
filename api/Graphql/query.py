from datetime import date, timedelta
from typing import List, Optional

import strawberry
from graphql import GraphQLError
from strawberry.types import Info

from Repository.test_set import TestSetRepository
from Repository.user import UserRepository
from Service.history import HistoryService
from Service.item import ItemService
from Service.screening_rule import GuidelineService, ScreeningRuleService
from Service.test_set import TestSetService
from Service.user import UserService
from auth_permissions import auth_from_info, is_admin, require_admin, require_auth
from schema import HistoryType, ItemType, ScreeningRuleType, TestSetType, UserType


@strawberry.type
class Query:

    @strawberry.field
    async def me(self, info: Info) -> Optional[UserType]:
        user_id, _role = auth_from_info(info)
        if user_id is None:
            return None
        user = await UserRepository.get_by_id(user_id)
        if not user:
            return None
        return UserService.to_type(user)

    @strawberry.field
    async def get_all_test_sets(self, info: Info) -> List[TestSetType]:
        user_id, role = require_auth(info)
        return await TestSetService.get_all_test_set_for_user(
            user_id, is_admin(role), with_histories=True
        )

    @strawberry.field
    async def get_test_set_by_id(self, info: Info, id: int) -> TestSetType:
        user_id, role = require_auth(info)
        ts = await TestSetRepository.get_by_id(id)
        if not ts:
            raise GraphQLError("Test set not found")
        if not is_admin(role) and ts.user_id != user_id:
            raise GraphQLError("Forbidden")
        return await TestSetService.get_by_id(id, with_histories=True)

    @strawberry.field
    async def get_all_users(self, info: Info) -> List[UserType]:
        require_admin(info)
        return await UserService.get_all_user()

    @strawberry.field
    async def get_user_by_id(self, info: Info, id: int) -> UserType:
        user_id, role = require_auth(info)
        if not is_admin(role) and id != user_id:
            raise GraphQLError("Forbidden")
        return await UserService.get_by_id(id)

    @strawberry.field
    async def get_all_items(self, info: Info) -> List[ItemType]:
        require_auth(info)
        return await ItemService.get_all_item()

    @strawberry.field
    async def get_item_by_id(self, info: Info, id: int) -> ItemType:
        require_auth(info)
        return await ItemService.get_by_id(id)

    @strawberry.field
    async def get_all_histories(self, info: Info) -> List[HistoryType]:
        require_admin(info)
        return await HistoryService.get_all_history()

    @strawberry.field
    async def get_my_histories(self, info: Info) -> List[HistoryType]:
        user_id, _role = require_auth(info)
        return await HistoryService.get_history_for_user(user_id)

    @strawberry.field
    async def get_history_by_id(self, info: Info, id: int) -> HistoryType:
        user_id, role = require_auth(info)
        h = await HistoryService.get_by_id(id)
        if not is_admin(role) and h.user_id != user_id:
            raise GraphQLError("Forbidden")
        return h

    @strawberry.field
    async def suggest_screening_interval(self, info: Info, user_id: int, item_id: int) -> int:
        actor_id, role = require_auth(info)
        if not is_admin(role) and user_id != actor_id:
            raise GraphQLError("Forbidden")
        return await GuidelineService.suggest_interval_days(user_id, item_id)

    @strawberry.field
    async def upcoming_reminders(
        self, info: Info, within_days: int = 30
    ) -> List[TestSetType]:
        user_id, role = require_auth(info)
        end = date.today() + timedelta(days=within_days)
        rows = await TestSetService.get_all_test_set_for_user(
            user_id, is_admin(role), with_histories=False
        )
        out: List[TestSetType] = []
        for ts in rows:
            if ts.next_date <= end:
                out.append(await TestSetService.get_by_id(ts.id, with_histories=False))
        return out

    @strawberry.field
    async def screening_rules_for_item(
        self, info: Info, item_id: int
    ) -> List[ScreeningRuleType]:
        require_admin(info)
        return await ScreeningRuleService.list_for_item(item_id)

    @strawberry.field
    async def screening_rules(self, info: Info) -> List[ScreeningRuleType]:
        require_admin(info)
        return await ScreeningRuleService.list_all()

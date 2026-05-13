import strawberry
from datetime import date, timedelta
from graphql import GraphQLError
from strawberry.types import Info
from typing import List, Optional

from Repository.history import HistoryRepository
from Repository.test_set import TestSetRepository
from Repository.user import UserRepository
from Service.history import HistoryService
from Service.item import ItemService
from Service.screening_rule import ScreeningRuleService
from Service.test_set import TestSetService
from Service.user import UserService
from auth_permissions import is_admin, require_admin, require_auth
from schema import (
    HistoryInput,
    HistoryType,
    ItemInput,
    ItemType,
    RecommendationApplyInput,
    ScreeningRuleInput,
    ScreeningRuleType,
    TestSetInput,
    TestSetType,
    UserInput,
    UserType,
)


async def _assert_test_set_access(test_set_id: int, actor_id: int, role: str):
    ts = await TestSetRepository.get_by_id(test_set_id)
    if not ts:
        raise GraphQLError("Test set not found")
    if not is_admin(role) and ts.user_id != actor_id:
        raise GraphQLError("Forbidden")
    return ts


@strawberry.type
class Mutation:

    @strawberry.mutation
    async def create_test_set(self, info: Info, test_set_data: TestSetInput) -> TestSetType:
        user_id, role = require_auth(info)
        if not is_admin(role) and test_set_data.user_id != user_id:
            raise GraphQLError("Forbidden")
        return await TestSetService.add_test_set(test_set_data)

    @strawberry.mutation
    async def delete_test_set(self, info: Info, test_set_id: int) -> str:
        user_id, role = require_auth(info)
        await _assert_test_set_access(test_set_id, user_id, role)
        return await TestSetService.delete(test_set_id)

    @strawberry.mutation
    async def update_test_set(
        self, info: Info, test_set_id: int, test_set_data: TestSetInput
    ) -> str:
        user_id, role = require_auth(info)
        await _assert_test_set_access(test_set_id, user_id, role)
        if not is_admin(role) and test_set_data.user_id != user_id:
            raise GraphQLError("Forbidden")
        return await TestSetService.update(test_set_id, test_set_data)

    @strawberry.mutation
    async def create_user(self, info: Info, user_data: UserInput) -> UserType:
        require_admin(info)
        return await UserService.add_user(user_data)

    @strawberry.mutation
    async def delete_user(self, info: Info, user_id: int) -> str:
        require_admin(info)
        return await UserService.delete(user_id)

    @strawberry.mutation
    async def update_user(self, info: Info, user_id: int, user_data: UserInput) -> str:
        actor_id, role = require_auth(info)
        if not is_admin(role) and user_id != actor_id:
            raise GraphQLError("Forbidden")
        return await UserService.update(user_id, user_data)

    @strawberry.mutation
    async def set_user_role(self, info: Info, user_id: int, role: str) -> str:
        require_admin(info)
        if role not in ("USER", "ADMIN"):
            raise GraphQLError("Invalid role")
        await UserRepository.set_role(user_id, role)
        return f"Updated role for user {user_id}"

    @strawberry.mutation
    async def create_item(self, info: Info, item_data: ItemInput) -> ItemType:
        require_admin(info)
        return await ItemService.add_item(item_data)

    @strawberry.mutation
    async def delete_item(self, info: Info, item_id: int) -> str:
        require_admin(info)
        return await ItemService.delete(item_id)

    @strawberry.mutation
    async def update_item(self, info: Info, item_id: int, item_data: ItemInput) -> str:
        require_admin(info)
        return await ItemService.update(item_id, item_data)

    @strawberry.mutation
    async def create_history(self, info: Info, history_data: HistoryInput) -> HistoryType:
        user_id, role = require_auth(info)
        await _assert_test_set_access(history_data.test_set_id, user_id, role)
        if not is_admin(role) and history_data.user_id != user_id:
            raise GraphQLError("Forbidden")
        return await HistoryService.add_history(history_data)

    @strawberry.mutation
    async def delete_history(self, info: Info, history_id: int) -> str:
        user_id, role = require_auth(info)
        h = await HistoryRepository.get_by_id(history_id)
        if not h:
            raise GraphQLError("History not found")
        await _assert_test_set_access(h.test_set_id, user_id, role)
        return await HistoryService.delete(history_id)

    @strawberry.mutation
    async def update_history(
        self, info: Info, history_id: int, history_data: HistoryInput
    ) -> str:
        user_id, role = require_auth(info)
        h = await HistoryRepository.get_by_id(history_id)
        if not h:
            raise GraphQLError("History not found")
        await _assert_test_set_access(h.test_set_id, user_id, role)
        if not is_admin(role) and history_data.user_id != user_id:
            raise GraphQLError("Forbidden")
        return await HistoryService.update(history_id, history_data)

    @strawberry.mutation
    async def create_screening_rule(
        self, info: Info, data: ScreeningRuleInput
    ) -> ScreeningRuleType:
        require_admin(info)
        return await ScreeningRuleService.create(data)

    @strawberry.mutation
    async def update_screening_rule(
        self, info: Info, rule_id: int, data: ScreeningRuleInput
    ) -> ScreeningRuleType:
        require_admin(info)
        return await ScreeningRuleService.update(rule_id, data)

    @strawberry.mutation
    async def delete_screening_rule(self, info: Info, rule_id: int) -> str:
        require_admin(info)
        return await ScreeningRuleService.delete(rule_id)

    @strawberry.mutation
    async def create_personal_item(
        self,
        info: Info,
        name: str,
        default_frequency: int,
        where_guidance_en: Optional[str] = None,
    ) -> ItemType:
        user_id, _role = require_auth(info)
        try:
            row = await ItemService.upsert_personal_item(
                user_id, name, default_frequency, where_guidance_en
            )
        except ValueError as e:
            raise GraphQLError(str(e)) from e
        return ItemService.to_type(row)

    @strawberry.mutation
    async def apply_recommendations(
        self, info: Info, user_id: int, rows: List[RecommendationApplyInput]
    ) -> List[TestSetType]:
        actor_id, role = require_auth(info)
        if not is_admin(role) and user_id != actor_id:
            raise GraphQLError("Forbidden")
        if not rows:
            raise GraphQLError("No recommendations selected")
        out: List[TestSetType] = []
        for row in rows:
            where = row.where_guidance_en
            if not where and row.frequency_text:
                where = row.frequency_text
            try:
                item = await ItemService.upsert_personal_item(
                    user_id, row.name, row.interval_days, where
                )
            except ValueError as e:
                raise GraphQLError(str(e)) from e
            fd = max(1, min(int(row.interval_days), 3650))
            next_d = date.today() + timedelta(days=fd)
            ts = TestSetInput(
                user_id=user_id,
                item_id=item.id,
                frequency=fd,
                next_date=next_d,
                reminder_lead_days=14,
            )
            out.append(await TestSetService.add_test_set(ts))
        return out

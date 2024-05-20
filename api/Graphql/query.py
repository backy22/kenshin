from typing import List

import strawberry

from Service.test_set import TestSetService
from Service.user import UserService
from Service.item import ItemService
from Service.history import HistoryService
from schema import TestSetType, UserType, ItemType, HistoryType


@strawberry.type
class Query:

    @strawberry.field
    async def get_all_test_sets(self) -> List[TestSetType]:
        return await TestSetService.get_all_test_set()

    @strawberry.field
    async def get_test_set_by_id(self, id: int) -> TestSetType:
        return await TestSetService.get_by_id(id)

    @strawberry.field
    async def get_all_users(self) -> List[UserType]:
        return await UserService.get_all_user()

    @strawberry.field
    async def get_user_by_id(self, id: int) -> UserType:
        return await UserService.get_by_id(id)

    @strawberry.field
    async def get_all_items(self) -> List[ItemType]:
        return await ItemService.get_all_item()

    @strawberry.field
    async def get_item_by_id(self, id: int) -> ItemType:
        return await ItemService.get_by_id(id)

    @strawberry.field
    async def get_all_histories(self) -> List[HistoryType]:
        return await HistoryService.get_all_history()

    @strawberry.field
    async def get_history_by_id(self, id: int) -> HistoryType:
        return await HistoryService.get_by_id(id)

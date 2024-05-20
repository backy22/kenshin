import strawberry
from Service.test_set import TestSetService
from Service.user import UserService
from Service.item import ItemService
from Service.history import HistoryService
from schema import TestSetType, TestSetInput, UserType, UserInput, ItemType, ItemInput, HistoryType, HistoryInput


@strawberry.type
class Mutation:

    @strawberry.mutation
    async def create_test_set(self, test_set_data: TestSetInput) -> TestSetType:
        return await TestSetService.add_test_set(test_set_data)

    @strawberry.mutation
    async def delete_test_set(self, test_set_id: int) -> str:
        return await TestSetService.delete(test_set_id)

    @strawberry.mutation
    async def update_test_set(self, test_set_id: int, test_set_data: TestSetInput) -> str:
        return await TestSetService.update(test_set_id,test_set_data)

    @strawberry.mutation
    async def create_user(self, user_data: UserInput) -> UserType:
        return await UserService.add_user(user_data)

    @strawberry.mutation
    async def delete_user(self, user_id: int) -> str:
        return await UserService.delete(user_id)

    @strawberry.mutation
    async def update_user(self, user_id: int, user_data: UserInput) -> str:
        return await UserService.update(user_id,user_data)

    @strawberry.mutation
    async def create_item(self, item_data: ItemInput) -> ItemType:
        return await ItemService.add_item(item_data)

    @strawberry.mutation
    async def delete_item(self, item_id: int) -> str:
        return await ItemService.delete(item_id)

    @strawberry.mutation
    async def update_item(self, item_id: int, item_data: ItemInput) -> str:
        return await ItemService.update(item_id,item_data)

    @strawberry.mutation
    async def create_history(self, history_data: HistoryInput) -> HistoryType:
        return await HistoryService.add_history(history_data)

    @strawberry.mutation
    async def delete_history(self, history_id: int) -> str:
        return await HistoryService.delete(history_id)

    @strawberry.mutation
    async def update_history(self, history_id: int, history_data: HistoryInput) -> str:
        return await HistoryService.update(history_id,history_data)
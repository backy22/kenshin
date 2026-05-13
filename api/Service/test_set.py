from Model.test_set import TestSet
from Repository.history import HistoryRepository
from Repository.item import ItemRepository
from Repository.test_set import TestSetRepository
from Repository.user import UserRepository
from Service.item import ItemService
from Service.user import UserService
from graphql import GraphQLError
from schema import HistoryType, TestSetInput, TestSetType


def _to_history_type(history) -> HistoryType:
    return HistoryType(
        id=history.id,
        user_id=history.user_id,
        date=history.date,
        clinic=history.clinic,
        result=history.result,
        test_set_id=history.test_set_id,
    )


class TestSetService:

    @staticmethod
    async def _to_test_set_type(test_set: TestSet, with_histories: bool) -> TestSetType:
        user = await UserRepository.get_by_id(test_set.user_id)
        item = await ItemRepository.get_by_id(test_set.item_id)
        histories = []
        if with_histories:
            raw = await HistoryRepository.get_all_by_test_set_id(test_set.id)
            histories = [_to_history_type(h) for h in raw]
        return TestSetType(
            id=test_set.id,
            user_id=test_set.user_id,
            item_id=test_set.item_id,
            frequency=test_set.frequency,
            next_date=test_set.next_date,
            reminder_lead_days=test_set.reminder_lead_days,
            last_reminder_at=test_set.last_reminder_at,
            user=UserService.to_type(user),
            item=ItemService.to_type(item),
            histories=histories,
        )

    @staticmethod
    async def add_test_set(test_set_data: TestSetInput):
        item = await ItemRepository.get_by_id(test_set_data.item_id)
        if not item:
            raise GraphQLError("Item not found")
        if item.owner_user_id is not None and item.owner_user_id != test_set_data.user_id:
            raise GraphQLError("This item is not available for the selected user")
        test_set = TestSet()
        test_set.user_id = test_set_data.user_id
        test_set.item_id = test_set_data.item_id
        test_set.frequency = test_set_data.frequency
        test_set.next_date = test_set_data.next_date
        test_set.reminder_lead_days = test_set_data.reminder_lead_days or 14
        await TestSetRepository.create(test_set)

        return await TestSetService._to_test_set_type(test_set, with_histories=True)

    @staticmethod
    async def get_all_test_set_for_user(user_id: int, is_admin: bool, with_histories: bool):
        if is_admin:
            rows = await TestSetRepository.get_all()
        else:
            rows = await TestSetRepository.get_all_by_user_id(user_id)
        result = []
        for ts in rows:
            result.append(await TestSetService._to_test_set_type(ts, with_histories=with_histories))
        return result

    @staticmethod
    async def get_by_id(test_set_id: int, with_histories: bool = True):
        test_set = await TestSetRepository.get_by_id(test_set_id)
        return await TestSetService._to_test_set_type(test_set, with_histories=with_histories)

    @staticmethod
    async def delete(test_set_id: int):
        await TestSetRepository.delete(test_set_id)
        return f'Successfully deleted data by id {test_set_id}'

    @staticmethod
    async def update(test_set_id: int, test_set_data: TestSetInput):
        item = await ItemRepository.get_by_id(test_set_data.item_id)
        if not item:
            raise GraphQLError("Item not found")
        if item.owner_user_id is not None and item.owner_user_id != test_set_data.user_id:
            raise GraphQLError("This item is not available for the selected user")
        test_set = TestSet()
        test_set.user_id = test_set_data.user_id
        test_set.item_id = test_set_data.item_id
        test_set.frequency = test_set_data.frequency
        test_set.next_date = test_set_data.next_date
        test_set.reminder_lead_days = test_set_data.reminder_lead_days or 14
        await TestSetRepository.update(test_set_id, test_set)
        return f'Successfully updated data by id {test_set_id}'

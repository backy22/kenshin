from Model.test_set import TestSet
from Repository.test_set import TestSetRepository
from Repository.user import UserRepository
from Repository.history import HistoryRepository
from schema import TestSetInput, TestSetType


class TestSetService:

    @staticmethod
    async def add_test_set(test_set_data: TestSetInput):
        test_set = TestSet()
        test_set.user_id = test_set_data.user_id
        test_set.item_id = test_set_data.item_id
        test_set.frequency = test_set_data.frequency
        test_set.next_date = test_set_data.next_date
        await TestSetRepository.create(test_set)
        user_data = await UserRepository.get_by_id(test_set.user_id)

        return TestSetType(
            id=test_set.id,
            user_id=test_set.user_id,
            item_id=test_set.item_id,
            frequency=test_set.frequency,
            next_date=test_set.next_date,
            user=user_data,
            histories=[]  # New test sets start with no histories
        )

    @staticmethod
    async def get_all_test_set():
        list_test_set = await TestSetRepository.get_all()
        result = []
        for test_set in list_test_set:
            user_data = await UserRepository.get_by_id(test_set.user_id)
            result.append(
                TestSetType(
                    id=test_set.id,
                    user_id=test_set.user_id,
                    item_id=test_set.item_id,
                    frequency=test_set.frequency,
                    next_date=test_set.next_date,
                    user=user_data,
                    histories=[]  # For list view, we don't need histories
                )
            )
        return result

    @staticmethod
    async def get_by_id(test_set_id: int):
        test_set = await TestSetRepository.get_by_id(test_set_id)
        user_data = await UserRepository.get_by_id(test_set.user_id)
        history_data = await HistoryRepository.get_all_by_test_set_id(test_set.id)
        return TestSetType(
            id=test_set.id,
            user_id=test_set.user_id,
            item_id=test_set.item_id,
            frequency=test_set.frequency,
            next_date=test_set.next_date,
            user=user_data,
            histories=history_data
        )

    @staticmethod
    async def delete(test_set_id: int):
        await TestSetRepository.delete(test_set_id)
        return f'Successfully deleted data by id {test_set_id}'

    @staticmethod
    async def update(test_set_id: int, test_set_data: TestSetInput):
        test_set = TestSet()
        test_set.user_id = test_set_data.user_id
        test_set.item_id = test_set_data.item_id
        test_set.frequency = test_set_data.frequency
        test_set.next_date = test_set_data.next_date
        await TestSetRepository.update(test_set_id, test_set)
        return f'Successfully updated data by id {test_set_id}'
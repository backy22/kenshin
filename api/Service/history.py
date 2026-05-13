from datetime import date, timedelta

from Model.history import History
from Model.test_set import TestSet
from Repository.history import HistoryRepository
from Repository.test_set import TestSetRepository
from schema import HistoryInput, HistoryType


def _to_history_type(history: History) -> HistoryType:
    return HistoryType(
        id=history.id,
        user_id=history.user_id,
        date=history.date,
        clinic=history.clinic,
        result=history.result,
        test_set_id=history.test_set_id,
    )


class HistoryService:

    @staticmethod
    async def add_history(history_data: HistoryInput):
        history = History()
        history.user_id = history_data.user_id
        history.date = history_data.date
        history.clinic = history_data.clinic
        history.result = history_data.result
        history.test_set_id = history_data.test_set_id
        await HistoryRepository.create(history)

        test_set = await TestSetRepository.get_by_id(history.test_set_id)
        if test_set:
            next_d = history.date + timedelta(days=test_set.frequency)
            await TestSetRepository.update_next_date(test_set.id, next_d)

        return _to_history_type(history)

    @staticmethod
    async def get_all_history():
        list_history = await HistoryRepository.get_all()
        return [_to_history_type(h) for h in list_history]

    @staticmethod
    async def get_history_for_user(user_id: int):
        list_history = await HistoryRepository.get_all_by_user_id(user_id)
        return [_to_history_type(h) for h in list_history]

    @staticmethod
    async def get_by_id(history_id: int):
        history = await HistoryRepository.get_by_id(history_id)
        return _to_history_type(history)

    @staticmethod
    async def delete(history_id: int):
        await HistoryRepository.delete(history_id)
        return f'Successfully deleted data by id {history_id}'

    @staticmethod
    async def update(history_id: int, history_data: HistoryInput):
        history = History()
        history.user_id = history_data.user_id
        history.date = history_data.date
        history.clinic = history_data.clinic
        history.result = history_data.result
        history.test_set_id = history_data.test_set_id
        await HistoryRepository.update(history_id, history)

        return f'Successfully updated data by id {history_id}'

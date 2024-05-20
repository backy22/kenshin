from Model.history import History
from Repository.history import HistoryRepository
from schema import HistoryInput, HistoryType


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

        return HistoryType(id=history.id, user_id=history.user_id, date=history.date, clinic=history.clinic, result=history.result, test_set_id=history.test_set_id)

    @staticmethod
    async def get_all_history():
        list_history = await HistoryRepository.get_all()
        return [HistoryType(id=history.id, user_id=history.user_id, date=history.date, clinic=history.clinic, result=history.result, test_set_id=history.test_set_id) for history in list_history]

    @staticmethod
    async def get_by_id(history_id: int):
        history = await HistoryRepository.get_by_id(history_id)
        return HistoryType(id=history.id, user_id=history.user_id, date=history.date, clinic=history.clinic, result=history.result, test_set_id=history.test_set_id)

    @staticmethod
    async def delete(history_id: int):
        await HistoryRepository.delete(history_id)
        return f'Successfully deleted data by id {history_id}'

    @staticmethod
    async def update(history_id:int, history_data: HistoryInput):
        history = History()
        history.user_id = history_data.user_id
        history.date = history_data.date
        history.clinic = history_data.clinic
        history.result = history_data.result
        history.test_set_id = history_data.test_set_id
        await HistoryRepository.update(history_id,history)

        return f'Successfully updated data by id {history_id}'
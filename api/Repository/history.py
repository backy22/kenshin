from Model.history import History
from config import db
from sqlalchemy.sql import select
from sqlalchemy import update as sql_update, delete as sql_delete


class HistoryRepository:

    @staticmethod
    async def create(history_data: History):
        async with db as session:
            async with session.begin():
                session.add(history_data)
            await db.commit_rollback()

    @staticmethod
    async def get_by_id(history_id: int):
        async with db as session:
            stmt = select(History).where(History.id == history_id)
            result = await session.execute(stmt)
            history = result.scalars().first()
            return history

    @staticmethod
    async def get_all():
        async with db as session:
            query = select(History)
            result = await session.execute(query)
            return result.scalars().all()


    @staticmethod
    async def get_all_by_test_set_id(test_set_id: int):
        async with db as session:
            stmt = select(History).where(History.test_set_id == test_set_id)
            result = await session.execute(stmt)
            return result.scalars().all()


    @staticmethod
    async def update(history_id: int, history_data: History):
        async with db as session:
            stmt = select(History).where(History.id == history_id)
            result = await session.execute(stmt)

            history = result.scalars().first()
            history.user_id = history_data.user_id
            history.date = history_data.date
            history.clinic = history_data.clinic
            history.result = history_data.result
            history.test_set_id = history_data.test_set_id

            query = sql_update(History).where(History.id == history_id).values(
                **history.dict()).execution_options(synchronize_session="fetch")

            await session.execute(query)
            await db.commit_rollback()

    @staticmethod
    async def delete(history_id: int):
        async with db as session:
            query = sql_delete(History).where(History.id == history_id)
            await session.execute(query)
            await db.commit_rollback()
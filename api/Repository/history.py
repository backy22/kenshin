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
                await session.flush()
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
    async def get_all_by_user_id(user_id: int):
        async with db as session:
            stmt = select(History).where(History.user_id == user_id)
            result = await session.execute(stmt)
            return result.scalars().all()

    @staticmethod
    async def get_all_by_test_set_id(test_set_id: int):
        async with db as session:
            stmt = (
                select(History)
                .where(History.test_set_id == test_set_id)
                .order_by(History.date.desc())
            )
            result = await session.execute(stmt)
            return result.scalars().all()


    @staticmethod
    async def update(history_id: int, history_data: History):
        async with db as session:
            stmt = select(History).where(History.id == history_id)
            result = await session.execute(stmt)

            history = result.scalars().first()
            if not history:
                return

            await session.execute(
                sql_update(History)
                .where(History.id == history_id)
                .values(
                    user_id=history_data.user_id,
                    date=history_data.date,
                    clinic=history_data.clinic,
                    result=history_data.result,
                    test_set_id=history_data.test_set_id,
                )
            )
            await db.commit_rollback()

    @staticmethod
    async def delete(history_id: int):
        async with db as session:
            query = sql_delete(History).where(History.id == history_id)
            await session.execute(query)
            await db.commit_rollback()
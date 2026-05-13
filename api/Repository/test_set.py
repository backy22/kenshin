from Model.test_set import TestSet
from config import db
from sqlalchemy.sql import select
from sqlalchemy import update as sql_update, delete as sql_delete


class TestSetRepository:

    @staticmethod
    async def create(test_set_data: TestSet):
        async with db.SessionLocal() as session:
            async with session.begin():
                session.add(test_set_data)
                await session.flush()

    @staticmethod
    async def get_by_id(test_set_id: int):
        async with db.SessionLocal() as session:
            stmt = select(TestSet).where(TestSet.id == test_set_id)
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def get_all_by_user_id(user_id: int):
        async with db.SessionLocal() as session:
            stmt = (
                select(TestSet)
                .where(TestSet.user_id == user_id)
                .order_by(TestSet.next_date.asc())
            )
            result = await session.execute(stmt)
            return result.scalars().all()

    @staticmethod
    async def get_all():
        async with db.SessionLocal() as session:
            query = select(TestSet).order_by(TestSet.next_date.asc())
            result = await session.execute(query)
            return result.scalars().all()

    @staticmethod
    async def update(test_set_id: int, test_set_data: TestSet):
        async with db.SessionLocal() as session:
            async with session.begin():
                stmt = select(TestSet).where(TestSet.id == test_set_id)
                result = await session.execute(stmt)
                test_set = result.scalars().first()
                
                if test_set:
                    test_set.user_id = test_set_data.user_id
                    test_set.item_id = test_set_data.item_id
                    test_set.frequency = test_set_data.frequency
                    test_set.next_date = test_set_data.next_date
                    test_set.reminder_lead_days = test_set_data.reminder_lead_days
                    await session.commit()

    @staticmethod
    async def touch_last_reminder(test_set_id: int, on_date) -> None:
        async with db.SessionLocal() as session:
            async with session.begin():
                stmt = select(TestSet).where(TestSet.id == test_set_id)
                result = await session.execute(stmt)
                test_set = result.scalars().first()
                if test_set:
                    test_set.last_reminder_at = on_date
                    await session.commit()

    @staticmethod
    async def update_next_date(test_set_id: int, next_date) -> None:
        async with db.SessionLocal() as session:
            async with session.begin():
                stmt = select(TestSet).where(TestSet.id == test_set_id)
                result = await session.execute(stmt)
                test_set = result.scalars().first()
                if test_set:
                    test_set.next_date = next_date
                    await session.commit()

    @staticmethod
    async def delete(test_set_id: int):
        async with db.SessionLocal() as session:
            async with session.begin():
                query = sql_delete(TestSet).where(TestSet.id == test_set_id)
                await session.execute(query)
                await session.commit()
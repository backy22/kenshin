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
                await session.commit()

    @staticmethod
    async def get_by_id(test_set_id: int):
        async with db.SessionLocal() as session:
            stmt = select(TestSet).where(TestSet.id == test_set_id)
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def get_all():
        async with db.SessionLocal() as session:
            query = select(TestSet)
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
                    await session.commit()

    @staticmethod
    async def delete(test_set_id: int):
        async with db.SessionLocal() as session:
            async with session.begin():
                query = sql_delete(TestSet).where(TestSet.id == test_set_id)
                await session.execute(query)
                await session.commit()
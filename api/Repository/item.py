from Model.item import Item
from config import db
from sqlalchemy.sql import select
from sqlalchemy import update as sql_update, delete as sql_delete


class ItemRepository:

    @staticmethod
    async def create(item_data: Item):
        async with db.SessionLocal() as session:
            async with session.begin():
                session.add(item_data)
                await session.commit()

    @staticmethod
    async def get_by_id(item_id: int):
        async with db.SessionLocal() as session:
            stmt = select(Item).where(Item.id == item_id)
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def get_all():
        async with db.SessionLocal() as session:
            query = select(Item)
            result = await session.execute(query)
            return result.scalars().all()

    @staticmethod
    async def update(item_id: int, item_data: Item):
        async with db.SessionLocal() as session:
            async with session.begin():
                stmt = select(Item).where(Item.id == item_id)
                result = await session.execute(stmt)
                item = result.scalars().first()
                
                if item:
                    item.name = item_data.name
                    item.default_frequency = item_data.default_frequency
                    await session.commit()

    @staticmethod
    async def delete(item_id: int):
        async with db.SessionLocal() as session:
            async with session.begin():
                query = sql_delete(Item).where(Item.id == item_id)
                await session.execute(query)
                await session.commit()
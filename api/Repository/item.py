from Model.item import Item
from config import db
from sqlalchemy import func, or_
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
    async def list_for_catalog(actor_user_id: int, is_admin: bool):
        async with db.SessionLocal() as session:
            stmt = select(Item)
            if not is_admin:
                stmt = stmt.where(
                    or_(Item.owner_user_id.is_(None), Item.owner_user_id == actor_user_id)
                )
            stmt = stmt.order_by(Item.name)
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def find_personal_by_owner_and_name(owner_user_id: int, name: str):
        key = name.strip().lower()
        if not key:
            return None
        async with db.SessionLocal() as session:
            stmt = select(Item).where(
                Item.owner_user_id == owner_user_id,
                func.lower(func.trim(Item.name)) == key,
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def update(item_id: int, item_data: Item):
        async with db.SessionLocal() as session:
            async with session.begin():
                stmt = select(Item).where(Item.id == item_id)
                result = await session.execute(stmt)
                item = result.scalars().first()
                
                if item:
                    item.name = item_data.name
                    item.name_key = item_data.name_key
                    item.where_guidance_en = item_data.where_guidance_en
                    item.default_frequency = item_data.default_frequency
                    await session.commit()

    @staticmethod
    async def delete(item_id: int):
        async with db.SessionLocal() as session:
            async with session.begin():
                query = sql_delete(Item).where(Item.id == item_id)
                await session.execute(query)
                await session.commit()

    @staticmethod
    async def update_personal_fields(item_id: int, default_frequency: int, where_guidance_en):
        async with db.SessionLocal() as session:
            async with session.begin():
                stmt = select(Item).where(Item.id == item_id)
                result = await session.execute(stmt)
                ent = result.scalars().first()
                if ent:
                    ent.default_frequency = default_frequency
                    if where_guidance_en is not None:
                        ent.where_guidance_en = where_guidance_en
                    await session.commit()
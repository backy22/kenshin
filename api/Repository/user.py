from Model.user import User
from config import db
from sqlalchemy.sql import select
from sqlalchemy import update as sql_update, delete as sql_delete


class UserRepository:

    @staticmethod
    async def create(user_data: User):
        async with db.SessionLocal() as session:
            async with session.begin():
                session.add(user_data)
                await session.commit()

    @staticmethod
    async def get_by_id(user_id: int):
        async with db.SessionLocal() as session:
            stmt = select(User).where(User.id == user_id)
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def get_all():
        async with db.SessionLocal() as session:
            query = select(User)
            result = await session.execute(query)
            return result.scalars().all()

    @staticmethod
    async def update(user_id: int, user_data: User):
        async with db.SessionLocal() as session:
            async with session.begin():
                stmt = select(User).where(User.id == user_id)
                result = await session.execute(stmt)
                user = result.scalars().first()
                
                if user:
                    user.name = user_data.name
                    user.email = user_data.email
                    user.birthday = user_data.birthday
                    user.gender = user_data.gender
                    await session.commit()

    @staticmethod
    async def delete(user_id: int):
        async with db.SessionLocal() as session:
            async with session.begin():
                query = sql_delete(User).where(User.id == user_id)
                await session.execute(query)
                await session.commit()
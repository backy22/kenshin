from typing import List, Optional

from sqlalchemy import delete as sql_delete
from sqlalchemy.sql import select

from Model.screening_rule import ScreeningRule
from config import db


class ScreeningRuleRepository:

    @staticmethod
    async def create(rule: ScreeningRule) -> ScreeningRule:
        async with db.SessionLocal() as session:
            async with session.begin():
                session.add(rule)
                await session.flush()
                return rule

    @staticmethod
    async def get_by_id(rule_id: int) -> Optional[ScreeningRule]:
        async with db.SessionLocal() as session:
            stmt = select(ScreeningRule).where(ScreeningRule.id == rule_id)
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def list_by_item(item_id: int) -> List[ScreeningRule]:
        async with db.SessionLocal() as session:
            stmt = select(ScreeningRule).where(ScreeningRule.item_id == item_id)
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def list_all() -> List[ScreeningRule]:
        async with db.SessionLocal() as session:
            stmt = select(ScreeningRule)
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def update(rule_id: int, data: ScreeningRule) -> None:
        async with db.SessionLocal() as session:
            async with session.begin():
                stmt = select(ScreeningRule).where(ScreeningRule.id == rule_id)
                result = await session.execute(stmt)
                rule = result.scalars().first()
                if rule:
                    rule.item_id = data.item_id
                    rule.min_age = data.min_age
                    rule.max_age = data.max_age
                    rule.applies_gender = data.applies_gender
                    rule.interval_days = data.interval_days
                    rule.priority = data.priority

    @staticmethod
    async def delete(rule_id: int) -> None:
        async with db.SessionLocal() as session:
            async with session.begin():
                await session.execute(sql_delete(ScreeningRule).where(ScreeningRule.id == rule_id))

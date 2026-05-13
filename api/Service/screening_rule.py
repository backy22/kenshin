from datetime import date

from Model.screening_rule import ScreeningRule
from Repository.item import ItemRepository
from Repository.screening_rule import ScreeningRuleRepository
from Repository.user import UserRepository
from guideline import pick_best_rule
from schema import ScreeningRuleInput, ScreeningRuleType


def _to_rule_type(rule: ScreeningRule) -> ScreeningRuleType:
    return ScreeningRuleType(
        id=rule.id,
        item_id=rule.item_id,
        min_age=rule.min_age,
        max_age=rule.max_age,
        applies_gender=rule.applies_gender,
        interval_days=rule.interval_days,
        priority=rule.priority,
    )


class ScreeningRuleService:

    @staticmethod
    async def list_all():
        rules = await ScreeningRuleRepository.list_all()
        return [_to_rule_type(r) for r in rules]

    @staticmethod
    async def list_for_item(item_id: int):
        rules = await ScreeningRuleRepository.list_by_item(item_id)
        return [_to_rule_type(r) for r in rules]

    @staticmethod
    async def create(data: ScreeningRuleInput):
        rule = ScreeningRule(
            item_id=data.item_id,
            min_age=data.min_age,
            max_age=data.max_age,
            applies_gender=data.applies_gender,
            interval_days=data.interval_days,
            priority=data.priority,
        )
        await ScreeningRuleRepository.create(rule)
        return _to_rule_type(rule)

    @staticmethod
    async def update(rule_id: int, data: ScreeningRuleInput):
        rule = ScreeningRule(
            item_id=data.item_id,
            min_age=data.min_age,
            max_age=data.max_age,
            applies_gender=data.applies_gender,
            interval_days=data.interval_days,
            priority=data.priority,
        )
        await ScreeningRuleRepository.update(rule_id, rule)
        existing = await ScreeningRuleRepository.get_by_id(rule_id)
        if not existing:
            raise ValueError("Screening rule not found after update")
        return _to_rule_type(existing)

    @staticmethod
    async def delete(rule_id: int):
        await ScreeningRuleRepository.delete(rule_id)
        return f"Deleted screening rule {rule_id}"


class GuidelineService:

    @staticmethod
    async def suggest_interval_days(user_id: int, item_id: int) -> int:
        user = await UserRepository.get_by_id(user_id)
        item = await ItemRepository.get_by_id(item_id)
        if not user or not item:
            raise ValueError("User or item not found")
        rules = await ScreeningRuleRepository.list_by_item(item_id)
        best = pick_best_rule(rules, user, date.today())
        if best:
            return best.interval_days
        return item.default_frequency

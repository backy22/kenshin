from datetime import date
from typing import List, Optional

from Model.user import User
from Model.screening_rule import ScreeningRule
from schema import Gender


def age_on(birthday: date, on: date) -> int:
    years = on.year - birthday.year
    if (on.month, on.day) < (birthday.month, birthday.day):
        years -= 1
    return years


def gender_matches(rule_gender: str, user_gender: Gender) -> bool:
    if rule_gender == "ALL":
        return True
    return rule_gender == user_gender.value


def age_matches(rule: ScreeningRule, age: int) -> bool:
    if rule.min_age is not None and age < rule.min_age:
        return False
    if rule.max_age is not None and age > rule.max_age:
        return False
    return True


def pick_best_rule(rules: List[ScreeningRule], user: User, today: date) -> Optional[ScreeningRule]:
    age = age_on(user.birthday, today)
    candidates: List[ScreeningRule] = []
    for r in rules:
        if not gender_matches(r.applies_gender, user.gender):
            continue
        if not age_matches(r, age):
            continue
        candidates.append(r)
    if not candidates:
        return None
    candidates.sort(key=lambda x: -x.priority)
    return candidates[0]

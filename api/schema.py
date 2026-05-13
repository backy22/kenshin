from datetime import date
from enum import Enum
from typing import List, Optional

import strawberry


@strawberry.enum
class Gender(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


@strawberry.type
class UserType:
    id: int
    name: str
    email: str
    birthday: date
    gender: Gender
    role: str
    location: Optional[str]


@strawberry.type
class ItemType:
    id: int
    name: str
    name_key: str
    where_guidance_en: Optional[str]
    default_frequency: int


@strawberry.type
class HistoryType:
    id: int
    user_id: int
    date: date
    clinic: str
    result: str
    test_set_id: int


@strawberry.type
class TestSetType:
    id: int
    user_id: int
    item_id: int
    frequency: int
    next_date: date
    reminder_lead_days: int
    last_reminder_at: Optional[date]
    user: UserType
    item: ItemType
    histories: List[HistoryType]


@strawberry.type
class ScreeningRuleType:
    id: int
    item_id: int
    min_age: Optional[int]
    max_age: Optional[int]
    applies_gender: str
    interval_days: int
    priority: int


@strawberry.type
class ScreeningRecommendationType:
    name: str
    frequency_text: str
    interval_days: int
    rationale: Optional[str] = None


@strawberry.input
class TestSetInput:
    user_id: int
    item_id: int
    frequency: int
    next_date: date
    reminder_lead_days: Optional[int] = 14


@strawberry.input
class UserInput:
    name: str
    email: str
    birthday: date
    gender: Gender
    initial_password: Optional[str] = None
    location: Optional[str] = None


@strawberry.input
class RecommendationApplyInput:
    name: str
    interval_days: int
    frequency_text: Optional[str] = None
    where_guidance_en: Optional[str] = None


@strawberry.input
class ItemInput:
    name: str
    name_key: str
    where_guidance_en: Optional[str] = None
    default_frequency: int


@strawberry.input
class HistoryInput:
    user_id: int
    date: date
    clinic: str
    result: str
    test_set_id: int


@strawberry.input
class ScreeningRuleInput:
    item_id: int
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    applies_gender: str = "ALL"
    interval_days: int
    priority: int = 0

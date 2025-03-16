from datetime import date
from enum import Enum
from typing import List
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


@strawberry.type
class ItemType:
    id: int
    name: str
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
    user: UserType
    histories: List[HistoryType]


@strawberry.input
class TestSetInput:
    user_id: int
    item_id: int
    frequency: int
    next_date: date


@strawberry.input
class UserInput:
    name: str
    email: str
    birthday: date
    gender: Gender


@strawberry.input
class ItemInput:
    name: str
    default_frequency: int


@strawberry.input
class HistoryInput:
    user_id: int
    date: date
    clinic: str
    result: str
    test_set_id: int

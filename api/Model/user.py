from sqlmodel import SQLModel, Field, Relationship
from schema import Gender
from datetime import date
from typing import TYPE_CHECKING, Optional, List
if TYPE_CHECKING:
    from Model.history import History
    from Model.test_set import TestSet
from sqlalchemy import Enum as SQLAlchemyEnum


class User(SQLModel, table=True):
    __tablename__ = "user"

    id: Optional[int] = Field(None, primary_key=True, nullable=False)
    name: str
    email: str
    birthday: date
    gender: Gender = Field(sa_column=SQLAlchemyEnum(Gender, name="gender", create_constraint=True, native_enum=True, values_callable=lambda obj: [e.value for e in obj]))

    histories: List["History"] = Relationship(back_populates="user")
    test_sets: List["TestSet"] = Relationship(back_populates="user")

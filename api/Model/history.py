from sqlmodel import SQLModel, Field, Relationship
from datetime import date
from typing import Optional, TYPE_CHECKING
if TYPE_CHECKING:
    from Model.test_set import TestSet
    from Model.user import User


class History(SQLModel, table=True):
    __tablename__ = "history"

    id: Optional[int] = Field(None, primary_key=True, nullable=False)
    date: date
    clinic: str
    result: str
    test_set_id: Optional[int] = Field(default=None, foreign_key="test_set.id", nullable=False)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", nullable=False)

    test_set: Optional["TestSet"] = Relationship(back_populates="histories")
    user: Optional["User"] = Relationship(back_populates="histories")
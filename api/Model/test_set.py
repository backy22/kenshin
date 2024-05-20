from sqlmodel import SQLModel, Field, Relationship
from datetime import date
from typing import Optional, TYPE_CHECKING, List
if TYPE_CHECKING:
    from Model.item import Item
    from Model.user import User
    from Model.history import History

class TestSet(SQLModel, table=True):
    __tablename__ = "test_set"

    id: Optional[int] = Field(None, primary_key=True, nullable=False)
    frequency:  int
    next_date: date
    item_id: Optional[int] = Field(default=None, foreign_key="item.id", nullable=False)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", nullable=False)

    item: Optional["Item"] = Relationship(back_populates="test_sets")
    user: Optional["User"] = Relationship(back_populates="test_sets")

    histories: List["History"] = Relationship(back_populates="test_set")
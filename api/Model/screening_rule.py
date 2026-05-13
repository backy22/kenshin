from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, TYPE_CHECKING, List
if TYPE_CHECKING:
    from Model.item import Item


class ScreeningRule(SQLModel, table=True):
    __tablename__ = "screening_rule"

    id: Optional[int] = Field(None, primary_key=True, nullable=False)
    item_id: int = Field(foreign_key="item.id", nullable=False)
    min_age: Optional[int] = Field(default=None, nullable=True)
    max_age: Optional[int] = Field(default=None, nullable=True)
    applies_gender: str = Field(default="ALL", max_length=20)
    interval_days: int
    priority: int = Field(default=0)

    item: Optional["Item"] = Relationship(back_populates="screening_rules")

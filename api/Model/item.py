from sqlmodel import SQLModel, Field, Relationship
from typing import TYPE_CHECKING, Optional, List
if TYPE_CHECKING:
    from Model.test_set import TestSet


class Item(SQLModel, table=True):
    __tablename__ = "item"

    id: Optional[int] = Field(None, primary_key=True, nullable=False)
    name: str
    default_frequency: int

    test_sets: List["TestSet"] = Relationship(back_populates="item")
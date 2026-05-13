from sqlmodel import SQLModel, Field, Relationship
from typing import TYPE_CHECKING, Optional, List
if TYPE_CHECKING:
    from Model.test_set import TestSet
    from Model.screening_rule import ScreeningRule


class Item(SQLModel, table=True):
    __tablename__ = "item"

    id: Optional[int] = Field(None, primary_key=True, nullable=False)
    name: str
    name_key: str = Field(default="item.unknown")
    where_guidance_en: Optional[str] = Field(default=None, nullable=True)
    default_frequency: int

    test_sets: List["TestSet"] = Relationship(back_populates="item")
    screening_rules: List["ScreeningRule"] = Relationship(back_populates="item")

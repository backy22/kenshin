from typing import Optional

from Model.item import Item
from Repository.item import ItemRepository
from schema import ItemInput, ItemType


class ItemService:

    @staticmethod
    def to_type(item: Item) -> ItemType:
        return ItemType(
            id=item.id,
            name=item.name,
            name_key=item.name_key or "item.unknown",
            where_guidance_en=item.where_guidance_en,
            default_frequency=item.default_frequency,
        )

    @staticmethod
    async def add_item(item_data: ItemInput):
        item = Item()
        item.name = item_data.name
        item.name_key = item_data.name_key
        item.where_guidance_en = item_data.where_guidance_en
        item.default_frequency = item_data.default_frequency
        item.owner_user_id = None
        await ItemRepository.create(item)

        return ItemService.to_type(item)

    @staticmethod
    async def get_all_for_actor(actor_user_id: int, is_admin: bool):
        rows = await ItemRepository.list_for_catalog(actor_user_id, is_admin)
        return [ItemService.to_type(i) for i in rows]

    @staticmethod
    async def get_all_item():
        """Admin / internal: all catalog rows (including every user's personal items)."""
        list_item = await ItemRepository.get_all()
        return [ItemService.to_type(item) for item in list_item]

    @staticmethod
    async def get_by_id(item_id: int):
        item = await ItemRepository.get_by_id(item_id)
        return ItemService.to_type(item)

    @staticmethod
    async def delete(item_id: int):
        await ItemRepository.delete(item_id)
        return f'Successfully deleted data by id {item_id}'

    @staticmethod
    async def update(item_id: int, item_data: ItemInput):
        item = Item()
        item.name = item_data.name
        item.name_key = item_data.name_key
        item.where_guidance_en = item_data.where_guidance_en
        item.default_frequency = item_data.default_frequency
        await ItemRepository.update(item_id, item)

        return f'Successfully updated data by id {item_id}'

    @staticmethod
    async def upsert_personal_item(
        owner_user_id: int,
        name: str,
        default_frequency: int,
        where_guidance_en: Optional[str] = None,
    ) -> Item:
        clean = name.strip()
        if not clean:
            raise ValueError("Item name is required")
        fd = max(1, min(int(default_frequency), 3650))
        existing = await ItemRepository.find_personal_by_owner_and_name(owner_user_id, clean)
        if existing:
            await ItemRepository.update_personal_fields(existing.id, fd, where_guidance_en)
            return await ItemRepository.get_by_id(existing.id)
        row = Item(
            name=clean,
            name_key="user.custom",
            where_guidance_en=where_guidance_en.strip() if where_guidance_en and where_guidance_en.strip() else None,
            default_frequency=fd,
            owner_user_id=owner_user_id,
        )
        await ItemRepository.create(row)
        saved = await ItemRepository.find_personal_by_owner_and_name(owner_user_id, clean)
        if not saved:
            raise RuntimeError("Failed to persist personal item")
        return saved

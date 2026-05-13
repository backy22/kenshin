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
        await ItemRepository.create(item)

        return ItemService.to_type(item)

    @staticmethod
    async def get_all_item():
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

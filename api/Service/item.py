from Model.item import Item
from Repository.item import ItemRepository
from schema import ItemInput, ItemType


class ItemService:

    @staticmethod
    async def add_item(item_data: ItemInput):
        item = Item()
        item.name = item_data.name
        item.default_frequency = item_data.default_frequency
        await ItemRepository.create(item)

        return ItemType(id=item.id, name=item.name, default_frequency=item.default_frequency)

    @staticmethod
    async def get_all_item():
        list_item = await ItemRepository.get_all()
        return [ItemType(id=item.id, name=item.name, default_frequency=item.default_frequency) for item in list_item]

    @staticmethod
    async def get_by_id(item_id: int):
        item = await ItemRepository.get_by_id(item_id)
        return ItemType(id=item.id, name=item.name, default_frequency=item.default_frequency)

    @staticmethod
    async def delete(item_id: int):
        await ItemRepository.delete(item_id)
        return f'Successfully deleted data by id {item_id}'

    @staticmethod
    async def update(item_id:int, item_data: ItemInput):
        item = Item()
        item.name = item_data.name
        item.default_frequency = item_data.default_frequency
        await ItemRepository.update(item_id,item)

        return f'Successfully updated data by id {item_id}'
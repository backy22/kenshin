from Model.user import User
from Repository.user import UserRepository
from schema import UserInput, UserType


class UserService:

    @staticmethod
    async def add_user(user_data: UserInput):
        user = User()
        user.name = user_data.name
        user.email = user_data.email
        user.birthday = user_data.birthday
        user.gender = user_data.gender
        await UserRepository.create(user)

        return UserType(id=user.id, name=user.name, email=user.email, birthday=user.birthday, gender=user.gender)

    @staticmethod
    async def get_all_user():
        list_user = await UserRepository.get_all()
        return [UserType(id=user.id, name=user.name, email=user.email, birthday=user.birthday, gender=user.gender) for user in list_user]

    @staticmethod
    async def get_by_id(user_id: int):
        user = await UserRepository.get_by_id(user_id)
        return UserType(id=user.id, name=user.name, email=user.email, birthday=user.birthday, gender=user.gender)

    @staticmethod
    async def delete(user_id: int):
        await UserRepository.delete(user_id)
        return f'Successfully deleted data by id {user_id}'

    @staticmethod
    async def update(user_id:int, user_data: UserInput):
        user = User()
        user.name = user_data.name
        user.email = user_data.email
        user.birthday = user_data.birthday
        user.gender = user_data.gender
        await UserRepository.update(user_id,user)

        return f'Successfully updated data by id {user_id}'
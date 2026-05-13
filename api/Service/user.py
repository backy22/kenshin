from Model.user import User
from Repository.user import UserRepository
from auth_security import hash_password
from schema import UserInput, UserType


class UserService:

    @staticmethod
    def to_type(user: User) -> UserType:
        return UserType(
            id=user.id,
            name=user.name,
            email=user.email,
            birthday=user.birthday,
            gender=user.gender,
            role=user.role or "USER",
            location=getattr(user, "location", None),
        )

    @staticmethod
    async def add_user(user_data: UserInput):
        user = User()
        user.name = user_data.name
        user.email = user_data.email
        user.birthday = user_data.birthday
        user.gender = user_data.gender
        user.password_hash = hash_password(user_data.initial_password or "changeme")
        user.role = "USER"
        await UserRepository.create(user)

        return UserService.to_type(user)

    @staticmethod
    async def get_all_user():
        list_user = await UserRepository.get_all()
        return [UserService.to_type(user) for user in list_user]

    @staticmethod
    async def get_by_id(user_id: int):
        user = await UserRepository.get_by_id(user_id)
        return UserService.to_type(user)

    @staticmethod
    async def delete(user_id: int):
        await UserRepository.delete(user_id)
        return f'Successfully deleted data by id {user_id}'

    @staticmethod
    async def update(user_id: int, user_data: UserInput):
        user = User()
        user.name = user_data.name
        user.email = user_data.email
        user.birthday = user_data.birthday
        user.gender = user_data.gender
        loc = user_data.location
        user.location = None if loc is None else (loc.strip() or None)
        await UserRepository.update(user_id, user)

        return f'Successfully updated data by id {user_id}'

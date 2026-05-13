from datetime import date

from pydantic import BaseModel, EmailStr

from fastapi import APIRouter, HTTPException

from Repository.user import UserRepository
from auth_security import create_access_token, hash_password, verify_password
from Model.user import User
from schema import Gender

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    name: str
    email: str


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginBody):
    user = await UserRepository.get_by_email(body.email)
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user_id=user.id, role=user.role)
    return LoginResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        name=user.name,
        email=user.email,
    )


class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    birthday: date
    gender: Gender


class RegisterResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    name: str
    email: str


@router.post("/register", response_model=RegisterResponse)
async def register(body: RegisterBody):
    existing = await UserRepository.get_by_email(body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        birthday=body.birthday,
        gender=body.gender,
        role="USER",
    )
    await UserRepository.create(user)
    token = create_access_token(user_id=user.id, role=user.role)
    return RegisterResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        name=user.name,
        email=user.email,
    )

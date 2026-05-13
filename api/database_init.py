import asyncio
import os
from datetime import date

from sqlalchemy import text
from sqlalchemy.sql import select

from auth_security import hash_password
from config import db
from Model.history import History  # noqa: F401
from Model.item import Item
from Model.screening_rule import ScreeningRule
from Model.test_set import TestSet  # noqa: F401
from Model.user import User
from Repository.user import UserRepository
from schema import Gender

DEV_PASSWORD_HASH = hash_password("password")

INITIAL_USERS = [
    User(
        name="Sarah Johnson",
        email="sarah.j@example.com",
        birthday=date(1985, 5, 15),
        gender=Gender.FEMALE,
        password_hash=DEV_PASSWORD_HASH,
        role="USER",
    ),
    User(
        name="Emily Chen",
        email="emily.chen@example.com",
        birthday=date(1990, 8, 23),
        gender=Gender.FEMALE,
        password_hash=DEV_PASSWORD_HASH,
        role="USER",
    ),
    User(
        name="Maria Garcia",
        email="maria.g@example.com",
        birthday=date(1988, 3, 10),
        gender=Gender.FEMALE,
        password_hash=DEV_PASSWORD_HASH,
        role="USER",
    ),
    User(
        name="Lisa Taylor",
        email="lisa.t@example.com",
        birthday=date(1992, 11, 30),
        gender=Gender.FEMALE,
        password_hash=DEV_PASSWORD_HASH,
        role="USER",
    ),
    User(
        name="Admin User",
        email="admin@example.com",
        birthday=date(1980, 1, 1),
        gender=Gender.OTHER,
        password_hash=DEV_PASSWORD_HASH,
        role="ADMIN",
    ),
]

INITIAL_ITEMS = [
    Item(
        name="Basic health check",
        name_key="item.basic_health_check",
        where_guidance_en="Employer health services, municipal clinics, or comprehensive checkup facilities.",
        default_frequency=365,
    ),
    Item(
        name="Human dock (comprehensive)",
        name_key="item.human_dock",
        where_guidance_en="Dedicated human dock clinics or hospitals.",
        default_frequency=365,
    ),
    Item(
        name="Gastric cancer screening",
        name_key="item.gastric_cancer",
        where_guidance_en="Hospital or clinic offering endoscopy or barium study.",
        default_frequency=730,
    ),
    Item(
        name="Colorectal cancer screening (FIT)",
        name_key="item.colon_cancer",
        where_guidance_en="Primary care, municipal screening, or hospital lab.",
        default_frequency=365,
    ),
    Item(
        name="Lung cancer screening (chest X-ray)",
        name_key="item.lung_cancer",
        where_guidance_en="Occupational health, municipal screening, or hospital radiology.",
        default_frequency=365,
    ),
    Item(
        name="Breast cancer screening (mammography)",
        name_key="item.breast",
        where_guidance_en="Hospital radiology or dedicated breast screening centers.",
        default_frequency=730,
    ),
    Item(
        name="Cervical cancer screening",
        name_key="item.cervical",
        where_guidance_en="OB/GYN clinic, municipal screening, or primary care with cytology.",
        default_frequency=730,
    ),
    Item(
        name="Dental checkup",
        name_key="item.dental",
        where_guidance_en="Dental clinic (cleaning and exam).",
        default_frequency=120,
    ),
]

# item.name must match keys here
SCREENING_RULE_SPECS = [
    {"item": "Basic health check", "min_age": 0, "max_age": 39, "applies_gender": "ALL", "interval_days": 548, "priority": 5},
    {"item": "Basic health check", "min_age": 40, "max_age": None, "applies_gender": "ALL", "interval_days": 365, "priority": 10},
    {"item": "Human dock (comprehensive)", "min_age": 40, "max_age": None, "applies_gender": "ALL", "interval_days": 365, "priority": 10},
    {"item": "Gastric cancer screening", "min_age": 50, "max_age": None, "applies_gender": "ALL", "interval_days": 730, "priority": 10},
    {"item": "Colorectal cancer screening (FIT)", "min_age": 40, "max_age": None, "applies_gender": "ALL", "interval_days": 365, "priority": 10},
    {"item": "Lung cancer screening (chest X-ray)", "min_age": 40, "max_age": None, "applies_gender": "ALL", "interval_days": 365, "priority": 10},
    {"item": "Breast cancer screening (mammography)", "min_age": 40, "max_age": None, "applies_gender": "FEMALE", "interval_days": 730, "priority": 10},
    {"item": "Cervical cancer screening", "min_age": 20, "max_age": None, "applies_gender": "FEMALE", "interval_days": 730, "priority": 10},
    {"item": "Dental checkup", "min_age": None, "max_age": None, "applies_gender": "ALL", "interval_days": 120, "priority": 0},
]


async def ensure_migrations():
    statements = [
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS password_hash TEXT',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT \'USER\'',
        "ALTER TABLE item ADD COLUMN IF NOT EXISTS name_key VARCHAR(128) DEFAULT 'item.unknown'",
        "ALTER TABLE item ADD COLUMN IF NOT EXISTS where_guidance_en TEXT",
        "ALTER TABLE test_set ADD COLUMN IF NOT EXISTS reminder_lead_days INTEGER DEFAULT 14",
        "ALTER TABLE test_set ADD COLUMN IF NOT EXISTS last_reminder_at DATE",
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS location VARCHAR(512)',
        'ALTER TABLE item ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES "user"(id)',
    ]
    async with db.engine.begin() as conn:
        for stmt in statements:
            await conn.execute(text(stmt))
        await conn.execute(
            text(
                'UPDATE "user" SET password_hash = :h, role = COALESCE(role, \'USER\') '
                "WHERE password_hash IS NULL"
            ),
            {"h": DEV_PASSWORD_HASH},
        )


async def init_database():
    try:
        await db.create_all()
        print("Database tables created successfully.")
        await ensure_migrations()

        await seed_users()
        if _env_truthy("KENSHIN_SYNC_DEV_ADMIN"):
            await sync_dev_admin_password()
        await seed_items()
        await seed_screening_rules()

        print("Database initialization completed.")
    except Exception as e:
        print(f"Error initializing database: {str(e)}")
        raise


def _env_truthy(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


async def seed_users():
    """Insert any seed user whose email is not already present (idempotent)."""
    try:
        added = 0
        async with db.SessionLocal() as session:
            for template in INITIAL_USERS:
                result = await session.execute(
                    select(User).where(User.email == template.email)
                )
                if result.scalars().first() is not None:
                    continue
                session.add(
                    User(
                        name=template.name,
                        email=template.email,
                        birthday=template.birthday,
                        gender=template.gender,
                        password_hash=DEV_PASSWORD_HASH,
                        role=template.role,
                    )
                )
                added += 1
            await session.commit()
        if added:
            print(f"Seeded {added} new user(s) (skipped emails that already exist).")
        else:
            print("User seed skipped: all seed emails already exist.")

    except Exception as e:
        print(f"Error seeding users: {str(e)}")
        raise


async def sync_dev_admin_password() -> None:
    """Reset dev admin password and role when KENSHIN_SYNC_DEV_ADMIN is enabled."""
    ok = await UserRepository.update_password_hash_and_role_by_email(
        "admin@example.com", DEV_PASSWORD_HASH, "ADMIN"
    )
    if ok:
        print("Dev admin (admin@example.com) password and role synchronized.")
    else:
        print(
            "KENSHIN_SYNC_DEV_ADMIN is set but admin@example.com is missing; "
            "it will be created on the next user seed if listed in INITIAL_USERS."
        )


async def seed_items():
    try:
        async with db.SessionLocal() as session:
            result = await session.execute(text("SELECT COUNT(*) FROM item"))
            count = result.scalar()

            if count > 0:
                print("Items already exist in the database. Skipping item seeding.")
                return

            for item in INITIAL_ITEMS:
                session.add(item)

            await session.commit()
            print("Successfully seeded items to the database.")

    except Exception as e:
        print(f"Error seeding items: {str(e)}")
        raise


async def seed_screening_rules():
    try:
        async with db.SessionLocal() as session:
            result = await session.execute(text("SELECT COUNT(*) FROM screening_rule"))
            if result.scalar() > 0:
                print("Screening rules already exist. Skipping rule seeding.")
                return

            res = await session.execute(select(Item))
            by_name = {i.name: i for i in res.scalars().all()}

            for spec in SCREENING_RULE_SPECS:
                item = by_name.get(spec["item"])
                if not item:
                    print(f"Skipping rules for missing item: {spec['item']}")
                    continue
                session.add(
                    ScreeningRule(
                        item_id=item.id,
                        min_age=spec.get("min_age"),
                        max_age=spec.get("max_age"),
                        applies_gender=spec["applies_gender"],
                        interval_days=spec["interval_days"],
                        priority=spec.get("priority", 0),
                    )
                )
            await session.commit()
            print("Successfully seeded screening rules.")

    except Exception as e:
        print(f"Error seeding screening rules: {str(e)}")
        raise


if __name__ == "__main__":
    asyncio.run(init_database())

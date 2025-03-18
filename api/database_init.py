import asyncio
from datetime import date
from config import db
from sqlalchemy import text
from Model.item import Item
from Model.test_set import TestSet  # Import all related models
from Model.user import User
from Model.history import History
from schema import Gender

# Define initial items
INITIAL_ITEMS = [
    Item(name='breast', default_frequency=730),  # 2 years = 730 days
    Item(name='cervical', default_frequency=730),  # 2 years = 730 days
    Item(name='colonoscopy', default_frequency=1095),  # 3 years = 1095 days
]

# Define initial users
INITIAL_USERS = [
    User(
        name='Sarah Johnson',
        email='sarah.j@example.com',
        birthday=date(1985, 5, 15),
        gender=Gender.FEMALE
    ),
    User(
        name='Emily Chen',
        email='emily.chen@example.com',
        birthday=date(1990, 8, 23),
        gender=Gender.FEMALE
    ),
    User(
        name='Maria Garcia',
        email='maria.g@example.com',
        birthday=date(1988, 3, 10),
        gender=Gender.FEMALE
    ),
    User(
        name='Lisa Taylor',
        email='lisa.t@example.com',
        birthday=date(1992, 11, 30),
        gender=Gender.FEMALE
    ),
]

async def init_database():
    try:
        # Create all tables
        await db.create_all()
        print("Database tables created successfully.")

        # Seed data
        await seed_users()
        await seed_items()
        
        print("Database initialization completed.")
    except Exception as e:
        print(f"Error initializing database: {str(e)}")
        raise

async def seed_users():
    try:
        async with db.SessionLocal() as session:
            # Check if users already exist
            result = await session.execute(text("SELECT COUNT(*) FROM \"user\""))
            count = result.scalar()
            
            if count > 0:
                print("Users already exist in the database. Skipping seeding.")
                return

            # Add users to the database
            for user in INITIAL_USERS:
                session.add(user)
            
            await session.commit()
            print("Successfully seeded users to the database.")
    
    except Exception as e:
        print(f"Error seeding users: {str(e)}")
        raise

async def seed_items():
    try:
        async with db.SessionLocal() as session:
            # Check if items already exist
            result = await session.execute(text("SELECT COUNT(*) FROM item"))
            count = result.scalar()
            
            if count > 0:
                print("Items already exist in the database. Skipping seeding.")
                return

            # Add items to the database
            for item in INITIAL_ITEMS:
                session.add(item)
            
            await session.commit()
            print("Successfully seeded items to the database.")
    
    except Exception as e:
        print(f"Error seeding items: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(init_database()) 
import strawberry
import uvicorn
from fastapi import FastAPI

from config import DatabaseSession
from database_init import init_database

from Graphql.query import Query
from Graphql.mutation import Mutation

from strawberry.fastapi import GraphQLRouter


def init_app():
    db = DatabaseSession()
    apps = FastAPI(
        title="Kenshin app",
        description="Manage your Health checkup",
        version="1.0.0"
    )

    @apps.on_event("startup")
    async def startup():
        await init_database()

    @apps.on_event("shutdown")
    async def shutdown():
        await db.close()

    @apps.get('/')
    def home():
        return "welcome home!"

    # add graphql endpoint
    schema = strawberry.Schema(query=Query, mutation=Mutation)
    graphql_app = GraphQLRouter(schema)

    apps.include_router(graphql_app, prefix="/graphql")

    return apps


app = init_app()

if __name__ == '__main__':
    uvicorn.run("main:app", host="0.0.0.0", port=8888, reload=True)
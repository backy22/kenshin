import asyncio
import logging
import os
from contextlib import asynccontextmanager

import strawberry
import uvicorn
from fastapi import FastAPI

from config import db
from database_init import init_database
from graphql_context import get_graphql_context
from Graphql.mutation import Mutation
from Graphql.query import Query
from reminders_job import start_reminder_worker
from routers.auth import router as auth_router
from strawberry.fastapi import GraphQLRouter


def _ensure_kenshin_logging() -> None:
    """Application logs under the ``kenshin`` logger (see gemini / GraphQL)."""
    log = logging.getLogger("kenshin")
    if log.handlers:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    log.addHandler(handler)
    log.setLevel(getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO))
    log.propagate = False


_ensure_kenshin_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_database()
    task = start_reminder_worker()
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    await db.close()


schema = strawberry.Schema(query=Query, mutation=Mutation)
graphql_app = GraphQLRouter(schema, context_getter=get_graphql_context)

app = FastAPI(
    title="Kenshin app",
    description="Manage your Health checkup",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/")
def home():
    return "welcome home!"


app.include_router(auth_router)
app.include_router(graphql_app, prefix="/graphql")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8888, reload=True)

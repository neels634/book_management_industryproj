import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# SQLite file locally. In production set DATABASE_URL to the AWS RDS database, e.g.
# postgresql://user:password@my-db.xxxxx.rds.amazonaws.com:5432/library
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./library.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

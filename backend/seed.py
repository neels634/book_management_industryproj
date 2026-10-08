"""Adds a few sample books and members to an empty database: python seed.py"""
from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Book, Member

BOOKS = [
    ("To Kill a Mockingbird", "Harper Lee", "9780061120084", "Fiction", 4),
    ("1984", "George Orwell", "9780451524935", "Fiction", 3),
    ("A Brief History of Time", "Stephen Hawking", "9780553380163", "Science", 2),
    ("Sapiens", "Yuval Noah Harari", "9780062316097", "History", 3),
    ("Clean Code", "Robert C. Martin", "9780132350884", "Technology", 2),
    ("The Pragmatic Programmer", "Andrew Hunt, David Thomas", "9780135957059", "Technology", 1),
]

MEMBERS = [
    ("Aarav Mehta", "aarav@example.com", "+91 98200 10001"),
    ("Diya Iyer", "diya@example.com", "+91 98200 10002"),
    ("Rohan Kapoor", "rohan@example.com", "+91 98200 10003"),
]

Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    if db.scalar(select(Book)):
        print("Database already has data - nothing added.")
    else:
        for title, author, isbn, category, copies in BOOKS:
            db.add(Book(title=title, author=author, isbn=isbn, category=category, total_copies=copies, available_copies=copies))
        for name, email, phone in MEMBERS:
            db.add(Member(name=name, email=email, phone=phone))
        db.commit()
        print(f"Added {len(BOOKS)} books and {len(MEMBERS)} members.")

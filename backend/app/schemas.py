from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _isbn_ok(isbn: str) -> bool:
    if len(isbn) == 10:
        if not (isbn[:9].isdigit() and (isbn[9].isdigit() or isbn[9] == "X")):
            return False
        total = sum((10 if c == "X" else int(c)) * (10 - i) for i, c in enumerate(isbn))
        return total % 11 == 0
    if len(isbn) == 13 and isbn.isdigit():
        return sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(isbn)) % 10 == 0
    return False


class BookIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(min_length=1, max_length=200)
    isbn: str
    category: str = Field(default="Other", min_length=1, max_length=60)
    total_copies: int = Field(ge=1, le=10000)

    @field_validator("isbn")
    @classmethod
    def valid_isbn(cls, value: str) -> str:
        isbn = value.replace("-", "").replace(" ", "").upper()
        if not _isbn_ok(isbn):
            raise ValueError("ISBN must be a valid ISBN-10 or ISBN-13")
        return isbn


class BookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    author: str
    isbn: str
    category: str
    total_copies: int
    available_copies: int
    is_active: bool


class MemberIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=120)
    phone: str = Field(default="", max_length=20)
    borrowing_limit: int = Field(default=3, ge=1, le=20)


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str
    borrowing_limit: int
    borrowed_count: int
    is_active: bool


class IssueIn(BaseModel):
    book_id: int
    member_id: int


class LoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    book_id: int
    member_id: int
    book_title: str
    member_name: str
    issue_date: datetime
    due_date: datetime
    return_date: datetime | None
    fine: float
    status: str  # ISSUED, OVERDUE or RETURNED

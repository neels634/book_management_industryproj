import os
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import Book, Loan, Member
from .schemas import BookIn, BookOut, IssueIn, LoanOut, MemberIn, MemberOut

LOAN_DAYS = int(os.getenv("LOAN_DAYS", "14"))
FINE_PER_DAY = float(os.getenv("FINE_PER_DAY", "5"))

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Book Management System")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def overdue_days(loan: Loan, at: datetime) -> int:
    return max(0, (at.date() - loan.due_date.date()).days)


def loan_out(loan: Loan) -> LoanOut:
    now = datetime.now()
    if loan.return_date:
        status = "RETURNED"
    elif loan.due_date.date() < now.date():
        status = "OVERDUE"
    else:
        status = "ISSUED"
    # Open overdue loans show the fine accrued so far.
    fine = loan.fine if loan.return_date else overdue_days(loan, now) * FINE_PER_DAY
    return LoanOut(
        id=loan.id,
        book_id=loan.book_id,
        member_id=loan.member_id,
        book_title=loan.book.title,
        member_name=loan.member.name,
        issue_date=loan.issue_date,
        due_date=loan.due_date,
        return_date=loan.return_date,
        fine=fine,
        status=status,
    )


def get_or_404(db: Session, model, item_id: int):
    item = db.get(model, item_id)
    if not item:
        raise HTTPException(404, f"{model.__name__} not found")
    return item


# ---------------------------------------------------------------- books

@app.get("/books", response_model=list[BookOut])
def list_books(q: str = "", include_inactive: bool = False, db: Session = Depends(get_db)):
    query = select(Book).order_by(Book.title)
    if not include_inactive:
        query = query.where(Book.is_active)
    if q:
        like = f"%{q}%"
        query = query.where(or_(Book.title.ilike(like), Book.author.ilike(like), Book.isbn.ilike(like), Book.category.ilike(like)))
    return db.scalars(query).all()


@app.post("/books", response_model=BookOut, status_code=201)
def create_book(data: BookIn, db: Session = Depends(get_db)):
    if db.scalar(select(Book).where(Book.isbn == data.isbn)):
        raise HTTPException(409, "A book with this ISBN already exists")
    book = Book(**data.model_dump(), available_copies=data.total_copies)
    db.add(book)
    db.commit()
    return book


@app.put("/books/{book_id}", response_model=BookOut)
def update_book(book_id: int, data: BookIn, db: Session = Depends(get_db)):
    book = get_or_404(db, Book, book_id)
    if db.scalar(select(Book).where(Book.isbn == data.isbn, Book.id != book_id)):
        raise HTTPException(409, "A book with this ISBN already exists")
    on_loan = book.total_copies - book.available_copies
    if data.total_copies < on_loan:
        raise HTTPException(409, f"{on_loan} copies are on loan; total copies cannot be lower")
    book.available_copies = data.total_copies - on_loan
    for key, value in data.model_dump().items():
        setattr(book, key, value)
    db.commit()
    return book


@app.delete("/books/{book_id}", response_model=BookOut)
def deactivate_book(book_id: int, db: Session = Depends(get_db)):
    """Soft delete: the book's loan history is kept."""
    book = get_or_404(db, Book, book_id)
    if book.available_copies < book.total_copies:
        raise HTTPException(409, "Copies of this book are still on loan")
    book.is_active = False
    db.commit()
    return book


# -------------------------------------------------------------- members

@app.get("/members", response_model=list[MemberOut])
def list_members(q: str = "", db: Session = Depends(get_db)):
    query = select(Member).where(Member.is_active).order_by(Member.name)
    if q:
        like = f"%{q}%"
        query = query.where(or_(Member.name.ilike(like), Member.email.ilike(like), Member.phone.ilike(like)))
    return db.scalars(query).all()


@app.post("/members", response_model=MemberOut, status_code=201)
def create_member(data: MemberIn, db: Session = Depends(get_db)):
    if db.scalar(select(Member).where(Member.email == data.email.lower())):
        raise HTTPException(409, "A member with this e-mail already exists")
    member = Member(**{**data.model_dump(), "email": data.email.lower()})
    db.add(member)
    db.commit()
    return member


@app.put("/members/{member_id}", response_model=MemberOut)
def update_member(member_id: int, data: MemberIn, db: Session = Depends(get_db)):
    member = get_or_404(db, Member, member_id)
    if db.scalar(select(Member).where(Member.email == data.email.lower(), Member.id != member_id)):
        raise HTTPException(409, "A member with this e-mail already exists")
    for key, value in {**data.model_dump(), "email": data.email.lower()}.items():
        setattr(member, key, value)
    db.commit()
    return member


@app.delete("/members/{member_id}", response_model=MemberOut)
def deactivate_member(member_id: int, db: Session = Depends(get_db)):
    member = get_or_404(db, Member, member_id)
    if member.borrowed_count > 0:
        raise HTTPException(409, "Member still has books on loan")
    member.is_active = False
    db.commit()
    return member


# ---------------------------------------------------------------- loans

@app.get("/loans", response_model=list[LoanOut])
def list_loans(status: str = "", member_id: int | None = None, db: Session = Depends(get_db)):
    query = select(Loan).order_by(Loan.issue_date.desc())
    if member_id:
        query = query.where(Loan.member_id == member_id)
    if status in ("ISSUED", "OVERDUE"):
        query = query.where(Loan.return_date.is_(None))
    if status == "RETURNED":
        query = query.where(Loan.return_date.is_not(None))
    loans = [loan_out(loan) for loan in db.scalars(query)]
    if status == "OVERDUE":
        loans = [loan for loan in loans if loan.status == "OVERDUE"]
    return loans


@app.post("/loans/issue", response_model=LoanOut, status_code=201)
def issue_book(data: IssueIn, db: Session = Depends(get_db)):
    book = get_or_404(db, Book, data.book_id)
    member = get_or_404(db, Member, data.member_id)
    if not book.is_active:
        raise HTTPException(409, "This book is no longer in circulation")
    if not member.is_active:
        raise HTTPException(409, "This member is not active")

    # Conditional updates: two simultaneous requests can never take the last copy
    # or push a member past the limit. Both run in one transaction.
    took_copy = db.execute(
        update(Book)
        .where(Book.id == book.id, Book.available_copies > 0)
        .values(available_copies=Book.available_copies - 1)
    ).rowcount
    if not took_copy:
        db.rollback()
        raise HTTPException(409, "No copies of this book are available")
    within_limit = db.execute(
        update(Member)
        .where(Member.id == member.id, Member.borrowed_count < Member.borrowing_limit)
        .values(borrowed_count=Member.borrowed_count + 1)
    ).rowcount
    if not within_limit:
        db.rollback()
        raise HTTPException(409, f"Member has reached the borrowing limit ({member.borrowing_limit})")

    now = datetime.now()
    loan = Loan(book_id=book.id, member_id=member.id, issue_date=now, due_date=now + timedelta(days=LOAN_DAYS))
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return loan_out(loan)


@app.post("/loans/{loan_id}/return", response_model=LoanOut)
def return_book(loan_id: int, db: Session = Depends(get_db)):
    loan = get_or_404(db, Loan, loan_id)
    now = datetime.now()
    fine = overdue_days(loan, now) * FINE_PER_DAY
    closed = db.execute(
        update(Loan).where(Loan.id == loan_id, Loan.return_date.is_(None)).values(return_date=now, fine=fine)
    ).rowcount
    if not closed:
        raise HTTPException(409, "This book has already been returned")
    db.execute(update(Book).where(Book.id == loan.book_id).values(available_copies=Book.available_copies + 1))
    db.execute(update(Member).where(Member.id == loan.member_id).values(borrowed_count=Member.borrowed_count - 1))
    db.commit()
    db.refresh(loan)
    return loan_out(loan)


# ------------------------------------------------------------ dashboard

@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    total, available = db.execute(
        select(func.coalesce(func.sum(Book.total_copies), 0), func.coalesce(func.sum(Book.available_copies), 0)).where(Book.is_active)
    ).one()
    open_loans = db.scalars(select(Loan).where(Loan.return_date.is_(None))).all()
    today = datetime.now().date()
    return {
        "total_books": total,
        "available_books": available,
        "issued_books": len(open_loans),
        "overdue_books": sum(1 for loan in open_loans if loan.due_date.date() < today),
        "total_members": db.scalar(select(func.count()).select_from(Member).where(Member.is_active)),
        "total_fines": db.scalar(select(func.coalesce(func.sum(Loan.fine), 0))),
        "fine_per_day": FINE_PER_DAY,
        "loan_days": LOAN_DAYS,
    }

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import create_access_token, hash_password
from ..database import get_db
from ..models import Company, CompanyUser, User
from ..schemas import UserCreate

router = APIRouter()


@router.post("/register")
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == payload.email).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    company = Company(
        company_name=payload.company_name
    )

    db.add(company)
    db.commit()
    db.refresh(company)

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        company_id=company.id,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    company_user = CompanyUser(
        company_id=company.id,
        user_id=user.id,
        role="owner",
    )

    db.add(company_user)
    db.commit()

    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": user.id,
            "company_id": company.id,
        }
    )

    return {
        "message": "User registered successfully",
        "user_id": user.id,
        "company_id": company.id,
        "company_name": company.company_name,
        "access_token": access_token,
        "token_type": "bearer",
    }
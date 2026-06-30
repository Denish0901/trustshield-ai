from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    company_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    message: str
    company_id: int
    access_token: str
    token_type: str


class VendorCreate(BaseModel):
    vendor_name: str
    official_email_domain: Optional[str] = None
    trusted_bank_account: Optional[str] = None
    trusted_phone: Optional[str] = None
    tax_id: Optional[str] = None
    address: Optional[str] = None


class VendorResponse(BaseModel):
    id: int
    company_id: int
    vendor_name: str
    official_email_domain: Optional[str] = None
    trusted_bank_account: Optional[str] = None
    trusted_phone: Optional[str] = None
    tax_id: Optional[str] = None
    address: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    id: int
    company_id: int
    vendor_id: Optional[int] = None

    original_filename: str
    file_path: str

    amount: Optional[float] = None
    currency: Optional[str] = None
    invoice_number: Optional[str] = None
    due_date: Optional[str] = None

    extracted_vendor_name: Optional[str] = None
    extracted_bank_account: Optional[str] = None
    extracted_text: Optional[str] = None

    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    risk_reasons: Optional[str] = None

    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
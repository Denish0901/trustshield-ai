from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="company")
    company_users = relationship("CompanyUser", back_populates="company")
    vendors = relationship("Vendor", back_populates="company")
    invoices = relationship("Invoice", back_populates="company")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)

    # IMPORTANT:
    # users.py uses password_hash, so the model must also use password_hash.
    password_hash = Column(String, nullable=False)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="users")
    company_users = relationship("CompanyUser", back_populates="user")


class CompanyUser(Base):
    __tablename__ = "company_users"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    role = Column(String, nullable=True, default="owner")
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="company_users")
    user = relationship("User", back_populates="company_users")


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    vendor_name = Column(String, nullable=False)
    official_email_domain = Column(String, nullable=True)
    trusted_bank_account = Column(String, nullable=False)
    trusted_phone = Column(String, nullable=True)
    tax_id = Column(String, nullable=True)
    address = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="vendors")
    invoices = relationship("Invoice", back_populates="vendor")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)

    filename = Column(String, nullable=True)
    extracted_text = Column(Text, nullable=True)

    extracted_vendor_name = Column(String, nullable=True)
    invoice_number = Column(String, nullable=True)
    amount = Column(Float, nullable=True)
    currency = Column(String, nullable=True)
    due_date = Column(String, nullable=True)
    extracted_bank_account = Column(String, nullable=True)

    risk_score = Column(Integer, nullable=True)
    risk_level = Column(String, nullable=True)
    risk_reasons = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="invoices")
    vendor = relationship("Vendor", back_populates="invoices")
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Vendor, Company
from ..schemas import VendorCreate, VendorResponse

router = APIRouter()


@router.post("/{company_id}", response_model=VendorResponse)
def create_vendor(
    company_id: int,
    payload: VendorCreate,
    db: Session = Depends(get_db)
):
    company = db.query(Company).filter(Company.id == company_id).first()

    if not company:
        raise HTTPException(
            status_code=404,
            detail="Company not found"
        )

    vendor = Vendor(
        company_id=company_id,
        vendor_name=payload.vendor_name,
        official_email_domain=payload.official_email_domain,
        trusted_bank_account=payload.trusted_bank_account,
        trusted_phone=payload.trusted_phone,
        tax_id=payload.tax_id,
        address=payload.address
    )

    db.add(vendor)
    db.commit()
    db.refresh(vendor)

    return vendor


@router.get("/{company_id}", response_model=List[VendorResponse])
def get_vendors(
    company_id: int,
    db: Session = Depends(get_db)
):
    company = db.query(Company).filter(Company.id == company_id).first()

    if not company:
        raise HTTPException(
            status_code=404,
            detail="Company not found"
        )

    vendors = db.query(Vendor).filter(
        Vendor.company_id == company_id
    ).order_by(Vendor.created_at.desc()).all()

    return vendors


@router.get("/single/{vendor_id}", response_model=VendorResponse)
def get_vendor_by_id(
    vendor_id: int,
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    return vendor


@router.delete("/{vendor_id}")
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    db.delete(vendor)
    db.commit()

    return {
        "message": "Vendor deleted successfully",
        "vendor_id": vendor_id
    }
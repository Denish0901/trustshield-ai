import os
import uuid

import fitz
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..fraud_scorer import calculate_invoice_risk
from ..invoice_parser import extract_invoice_fields
from ..models import Company, Invoice, Vendor

router = APIRouter()

UPLOAD_DIR = "app/uploads"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

os.makedirs(UPLOAD_DIR, exist_ok=True)


def extract_text_from_pdf(file_path: str) -> str:
    text = ""

    try:
        document = fitz.open(file_path)

        for page in document:
            text += page.get_text()

        document.close()
        return text.strip()

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read PDF text. Please upload a readable invoice PDF.",
        )


@router.post("/upload")
async def upload_invoice(
    company_id: int = Form(...),
    vendor_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    temp_file_path = None

    try:
        company = db.query(Company).filter(Company.id == company_id).first()

        if not company:
            raise HTTPException(status_code=404, detail="Company not found.")

        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == vendor_id, Vendor.company_id == company_id)
            .first()
        )

        if not vendor:
            raise HTTPException(status_code=404, detail="Trusted vendor not found.")

        if not file.filename:
            raise HTTPException(status_code=400, detail="No file uploaded.")

        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

        file_content = await file.read()

        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="File is too large. Maximum allowed size is 5 MB.",
            )

        if not file_content.startswith(b"%PDF"):
            raise HTTPException(
                status_code=400,
                detail="Invalid PDF file. Please upload a real PDF invoice.",
            )

        safe_filename = f"{uuid.uuid4()}_{file.filename}"
        temp_file_path = os.path.join(UPLOAD_DIR, safe_filename)

        with open(temp_file_path, "wb") as temp_file:
            temp_file.write(file_content)

        extracted_text = extract_text_from_pdf(temp_file_path)

        invoice_data = extract_invoice_fields(extracted_text)

        duplicate_invoice_found = False

        if invoice_data.get("invoice_number"):
            existing_invoice = (
                db.query(Invoice)
                .filter(
                    Invoice.company_id == company_id,
                    Invoice.invoice_number == invoice_data.get("invoice_number"),
                )
                .first()
            )

            duplicate_invoice_found = existing_invoice is not None

        risk_result = calculate_invoice_risk(
            invoice_data=invoice_data,
            vendor=vendor,
            duplicate_invoice_found=duplicate_invoice_found,
        )

        risk_reasons = risk_result.get("reasons", [])

        invoice = Invoice(
            company_id=company_id,
            vendor_id=vendor_id,
            filename=file.filename,
            extracted_text=extracted_text,
            extracted_vendor_name=invoice_data.get("vendor_name"),
            invoice_number=invoice_data.get("invoice_number"),
            amount=invoice_data.get("amount"),
            currency=invoice_data.get("currency"),
            due_date=invoice_data.get("due_date"),
            extracted_bank_account=invoice_data.get("bank_account"),
            risk_score=risk_result.get("risk_score"),
            risk_level=risk_result.get("risk_level"),
            risk_reasons=risk_reasons,
        )

        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        return {
            "message": "Invoice scanned successfully",
            "invoice_id": invoice.id,
            "company_id": invoice.company_id,
            "vendor_id": invoice.vendor_id,
            "filename": invoice.filename,
            "extracted_vendor_name": invoice.extracted_vendor_name,
            "invoice_number": invoice.invoice_number,
            "amount": invoice.amount,
            "currency": invoice.currency,
            "due_date": invoice.due_date,
            "extracted_bank_account": invoice.extracted_bank_account,
            "risk_score": invoice.risk_score,
            "risk_level": invoice.risk_level,
            "risk_reasons": invoice.risk_reasons,
        }

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@router.get("/summary/{company_id}")
def get_invoice_summary(company_id: int, db: Session = Depends(get_db)):
    invoices = db.query(Invoice).filter(Invoice.company_id == company_id).all()

    total_invoices = len(invoices)
    low_risk = len([invoice for invoice in invoices if invoice.risk_level == "LOW"])
    medium_risk = len([invoice for invoice in invoices if invoice.risk_level == "MEDIUM"])
    high_risk = len([invoice for invoice in invoices if invoice.risk_level == "HIGH"])

    total_amount = 0

    for invoice in invoices:
        if invoice.amount:
            total_amount += invoice.amount

    return {
        "company_id": company_id,
        "total_invoices": total_invoices,
        "low_risk": low_risk,
        "medium_risk": medium_risk,
        "high_risk": high_risk,
        "total_amount": round(total_amount, 2),
    }


@router.get("/risk/{invoice_id}")
def get_invoice_risk(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    return {
        "invoice_id": invoice.id,
        "risk_score": invoice.risk_score,
        "risk_level": invoice.risk_level,
        "risk_reasons": invoice.risk_reasons,
    }


@router.get("/explain/{invoice_id}")
def explain_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if invoice.risk_level == "LOW":
        summary = "This invoice looks safe for payment."
        recommendation = "Payment can be approved after normal business verification."

    elif invoice.risk_level == "MEDIUM":
        summary = "This invoice needs manual review before payment."
        recommendation = (
            "Check the invoice number, amount, due date, and vendor details before "
            "approving payment."
        )

    elif invoice.risk_level == "HIGH":
        summary = "This invoice has strong fraud signals."
        recommendation = (
            "Do not pay this invoice until the vendor confirms the bank account and "
            "invoice details through a trusted channel."
        )

    else:
        summary = "Risk level is unknown."
        recommendation = "Review this invoice manually."

    return {
        "invoice_id": invoice.id,
        "summary": summary,
        "explanation": invoice.risk_reasons or [],
        "recommendation": recommendation,
    }


@router.get("/single/{invoice_id}")
def get_single_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    return invoice


# IMPORTANT:
# Keep this route at the bottom.
# If this is above /explain/{invoice_id}, /risk/{invoice_id}, or /single/{invoice_id},
# FastAPI can confuse the route.
@router.get("/{company_id}")
def get_company_invoices(company_id: int, db: Session = Depends(get_db)):
    invoices = (
        db.query(Invoice)
        .filter(Invoice.company_id == company_id)
        .order_by(Invoice.id.desc())
        .all()
    )

    return invoices
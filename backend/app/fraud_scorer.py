def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return value.strip().lower()


def normalize_bank(value: str | None) -> str:
    if not value:
        return ""
    return value.replace(" ", "").replace("-", "").strip().lower()


def calculate_invoice_risk(
    invoice_data: dict,
    vendor,
    duplicate_invoice_found: bool = False
) -> dict:
    risk_score = 0
    reasons = []

    extracted_vendor_name = normalize_text(invoice_data.get("vendor_name"))
    trusted_vendor_name = normalize_text(vendor.vendor_name)

    extracted_bank_account = normalize_bank(invoice_data.get("bank_account"))
    trusted_bank_account = normalize_bank(vendor.trusted_bank_account)

    invoice_number = invoice_data.get("invoice_number")
    due_date = invoice_data.get("due_date")
    amount = invoice_data.get("amount")

    # 1. Duplicate invoice number check
    if duplicate_invoice_found:
        risk_score += 40
        reasons.append("Duplicate invoice number found for this company")
    else:
        reasons.append("Invoice number is not duplicated")

    # 2. Vendor name check
    if extracted_vendor_name and trusted_vendor_name:
        if extracted_vendor_name == trusted_vendor_name:
            reasons.append("Vendor name matches trusted vendor record")
        else:
            risk_score += 30
            reasons.append("Vendor name does not match trusted vendor record")
    else:
        risk_score += 15
        reasons.append("Vendor name could not be fully verified")

    # 3. Bank account check
    if extracted_bank_account and trusted_bank_account:
        if extracted_bank_account == trusted_bank_account:
            reasons.append("Bank account matches trusted vendor record")
        else:
            risk_score += 50
            reasons.append("Bank account does not match trusted vendor record")
    else:
        risk_score += 40
        reasons.append("Bank account could not be fully verified")

    # 4. Amount check
    if amount is not None:
        if amount > 10000:
            risk_score += 20
            reasons.append("Invoice amount is unusually high")
        else:
            reasons.append("Invoice amount is within normal range")
    else:
        risk_score += 10
        reasons.append("Invoice amount could not be extracted")

    # 5. Missing invoice number check
    if not invoice_number:
        risk_score += 15
        reasons.append("Invoice number is missing")

    # 6. Missing due date check
    if not due_date:
        risk_score += 10
        reasons.append("Due date is missing")

    # Final risk level
    if risk_score >= 70:
        risk_level = "HIGH"
    elif risk_score >= 30:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "reasons": reasons
    }
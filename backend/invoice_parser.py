import re


def extract_invoice_fields(text: str) -> dict:
    if not text:
        return {
            "vendor_name": None,
            "invoice_number": None,
            "amount": None,
            "currency": None,
            "due_date": None,
            "bank_account": None
        }

    fields = {
        "vendor_name": None,
        "invoice_number": None,
        "amount": None,
        "currency": None,
        "due_date": None,
        "bank_account": None
    }

    vendor_patterns = [
        r"Vendor Name[:\s]+(.+)",
        r"Vendor[:\s]+(.+)",
        r"Supplier[:\s]+(.+)"
    ]

    invoice_number_patterns = [
        r"Invoice Number[:\s]+([A-Za-z0-9\-]+)",
        r"Invoice No[:\s]+([A-Za-z0-9\-]+)",
        r"Invoice #[:\s]+([A-Za-z0-9\-]+)"
    ]

    amount_patterns = [
        r"Amount[:\s]+([0-9,.]+)\s*(EUR|USD|INR|GBP)?",
        r"Total[:\s]+([0-9,.]+)\s*(EUR|USD|INR|GBP)?",
        r"Grand Total[:\s]+([0-9,.]+)\s*(EUR|USD|INR|GBP)?"
    ]

    due_date_patterns = [
        r"Due Date[:\s]+(.+)",
        r"Payment Due[:\s]+(.+)"
    ]

    bank_patterns = [
        r"Bank Account[:\s]+([A-Za-z0-9\s\-]+)",
        r"IBAN[:\s]+([A-Za-z0-9\s\-]+)",
        r"Account Number[:\s]+([A-Za-z0-9\s\-]+)"
    ]

    for pattern in vendor_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            fields["vendor_name"] = match.group(1).strip()
            break

    for pattern in invoice_number_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            fields["invoice_number"] = match.group(1).strip()
            break

    for pattern in amount_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_text = match.group(1).replace(",", "").strip()
            try:
                fields["amount"] = float(amount_text)
            except ValueError:
                fields["amount"] = None

            if len(match.groups()) >= 2 and match.group(2):
                fields["currency"] = match.group(2).strip()
            break

    for pattern in due_date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            fields["due_date"] = match.group(1).strip()
            break

    for pattern in bank_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            fields["bank_account"] = match.group(1).strip()
            break

    return fields
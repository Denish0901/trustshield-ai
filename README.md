# TrustShield AI

TrustShield AI is an AI-powered invoice and payment verification platform designed to help companies detect risky invoice payments before money is transferred.

The system scans invoice PDFs, extracts important payment details, compares them with trusted vendor records, and calculates a fraud risk score before payment approval.

---

## Problem

Businesses often receive invoice payment requests from vendors. Fraud can happen when an attacker changes bank account details, sends fake invoices, or creates duplicate payment requests.

TrustShield AI helps reduce this risk by checking invoice data against trusted vendor records before payment is approved.

---

## Features

- Create a business vault
- Add trusted vendor information
- Upload invoice PDFs
- Extract invoice fields automatically
- Compare vendor name and bank account
- Detect duplicate invoice numbers
- Calculate fraud risk score
- Show payment decision:
  - Approved for payment
  - Review required
  - Payment blocked
- View invoice activity history
- Modern fintech-style dashboard

---

## Screenshots
 419126 Screenshot 2026-06-28 181658.png
 407424 Screenshot 2026-06-28 181724.png

## Tech Stack

### Frontend

- React
- Vite
- Axios
- CSS

### Backend

- Python
- FastAPI
- SQLAlchemy
- SQLite
- PyMuPDF

---

## Local Setup

### Backend

```bash
cd backend
python -m uvicorn app.main:app --reload

## Disclaimer

TrustShield AI is a demo MVP project built for learning and portfolio purposes.

It is not financial advice, legal advice, or a certified fraud-prevention product. The system provides automated risk indicators to support manual invoice review. Final payment decisions should always be verified by a responsible person.

Please do not upload real invoices, real customer data, or real bank account details to the demo version.
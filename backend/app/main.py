from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routes import users, vendors, invoices

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TrustShield AI API",
    description="AI-powered invoice and payment request trust verification backend",
    version="1.0.0",
)

# Local development CORS
# This allows frontend from localhost:5173, localhost:5174, etc.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+|https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(vendors.router, prefix="/vendors", tags=["Vendors"])
app.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])


@app.get("/")
def root():
    return {
        "message": "TrustShield AI API is running",
        "docs": "Go to http://127.0.0.1:8000/docs",
        "frontend": "Run frontend with npm run dev",
        "invoice_upload_route": "POST /invoices/upload",
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "TrustShield AI Backend",
    }
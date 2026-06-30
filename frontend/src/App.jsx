import { useEffect, useState } from "react";
import axios from "axios";
import {
  Home,
  ScanLine,
  FileCheck2,
  History,
  RefreshCw,
  RotateCcw,
  UploadCloud,
  FileText,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Inbox,
} from "lucide-react";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const MAX_INVOICE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Status -> color token + icon, shared across the score gauge and metric cards.
const STATUS_META = {
  safe: { color: "var(--safe)", track: "var(--safe-wash)", Icon: ShieldCheck },
  review: { color: "var(--review)", track: "var(--review-wash)", Icon: ShieldAlert },
  blocked: { color: "var(--blocked)", track: "var(--blocked-wash)", Icon: ShieldX },
  neutral: { color: "var(--brass)", track: "var(--brass-wash)", Icon: ShieldCheck },
};

/**
 * VaultDial — the signature gauge: a combination-lock style radial dial
 * with tick marks, used for the protection score and risk score.
 */
function VaultDial({ value = 0, max = 100, size = 150, status = "neutral", label, onDark = false }) {
  const meta = STATUS_META[status] || STATUS_META.neutral;
  const stroke = size * 0.085;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / max));
  const offset = circumference * (1 - pct);
  const center = size / 2;
  const tickCount = 24;
  const ticks = Array.from({ length: tickCount }).map((_, i) => {
    const angle = (i / tickCount) * 2 * Math.PI - Math.PI / 2;
    const inner = radius - stroke / 2 - 3;
    const outer = radius - stroke / 2 + 1;
    const x1 = center + inner * Math.cos(angle);
    const y1 = center + inner * Math.sin(angle);
    const x2 = center + outer * Math.cos(angle);
    const y2 = center + outer * Math.sin(angle);
    return { x1, y1, x2, y2, key: i };
  });

  return (
    <div className={"ts-dial" + (onDark ? " on-dark" : "")} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={onDark ? "rgba(255,255,255,0.1)" : "var(--line)"}
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={meta.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
        />
        {ticks.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={onDark ? "rgba(255,255,255,0.18)" : "var(--line)"}
            strokeWidth={1.4}
          />
        ))}
      </svg>

      <div className="ts-dial-label">
        <small>{label}</small>
        <strong style={{ fontSize: size * 0.27 }}>{value}</strong>
      </div>
    </div>
  );
}

function App() {
  const savedCompanyId = localStorage.getItem("trustshield_company_id") || "";
  const savedVendorId = localStorage.getItem("trustshield_vendor_id") || "";

  const [screen, setScreen] = useState(
    savedCompanyId && savedVendorId ? "app" : "welcome"
  );

  const [activeTab, setActiveTab] = useState("home");
  const [setupStep, setSetupStep] = useState(savedCompanyId ? 2 : 1);

  const [companyId, setCompanyId] = useState(savedCompanyId);
  const [vendorId, setVendorId] = useState(savedVendorId);
  const [invoiceId, setInvoiceId] = useState("");

  const [registerData, setRegisterData] = useState({
    name: "Denish",
    email: `denish${Date.now()}@test.com`,
    password: "123456",
    company_name: "Denish Company",
  });

  const [vendorData, setVendorData] = useState({
    vendor_name: "Alpha Supplies",
    official_email_domain: "alpha-supplies.com",
    trusted_bank_account: "DE55123412341234",
    trusted_phone: "+49123456789",
    tax_id: "TAX12345",
    address: "Berlin, Germany",
  });

  const [invoiceFile, setInvoiceFile] = useState(null);
  const [uploadConsent, setUploadConsent] = useState(false);
  const [latestScan, setLatestScan] = useState(null);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const setupDone = companyId && vendorId;

  useEffect(() => {
    if (setupDone) {
      refreshDataSilent(companyId);
    }
  }, [companyId, vendorId]);

  const showMessage = (text) => {
    setMessage(text);

    setTimeout(() => {
      setMessage("");
    }, 4500);
  };

  const riskClass = (riskLevel) => {
    if (!riskLevel) return "unknown";
    return riskLevel.toLowerCase();
  };

  const dialStatus = (riskLevel) => {
    if (riskLevel === "LOW") return "safe";
    if (riskLevel === "MEDIUM") return "review";
    if (riskLevel === "HIGH") return "blocked";
    return "neutral";
  };

  const paymentDecision = (riskLevel) => {
    if (riskLevel === "LOW") return "Approved for payment";
    if (riskLevel === "MEDIUM") return "Review required";
    if (riskLevel === "HIGH") return "Payment blocked";
    return "Ready to scan";
  };

  const paymentDecisionText = (riskLevel) => {
    if (riskLevel === "LOW") {
      return "The invoice matches your trusted vendor profile and looks safe.";
    }

    if (riskLevel === "MEDIUM") {
      return "Some payment details need manual review before approval.";
    }

    if (riskLevel === "HIGH") {
      return "This invoice has strong fraud signals. Do not pay until verified.";
    }

    return "Upload an invoice PDF to receive an instant payment safety decision.";
  };

  const validateInvoiceFile = (selectedFile) => {
    if (!selectedFile) {
      return false;
    }

    if (selectedFile.type !== "application/pdf") {
      showMessage("Only PDF invoice files are allowed.");
      return false;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      showMessage("Only PDF invoice files are allowed.");
      return false;
    }

    if (selectedFile.size > MAX_INVOICE_FILE_SIZE) {
      showMessage("File is too large. Maximum allowed size is 5 MB.");
      return false;
    }

    return true;
  };

  const createWorkspace = async () => {
    try {
      setBusy(true);
      showMessage("Creating secure business vault...");

      const response = await axios.post(
        API_BASE_URL + "/users/register",
        registerData
      );

      const newCompanyId = String(response.data.company_id);

      setCompanyId(newCompanyId);
      localStorage.setItem("trustshield_company_id", newCompanyId);

      setSetupStep(2);
      showMessage("Business vault created. Add a trusted vendor.");
    } catch (error) {
      showMessage(error.response?.data?.detail || "Workspace creation failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveVendor = async () => {
    try {
      if (!companyId) {
        showMessage("Create your business vault first.");
        setSetupStep(1);
        return;
      }

      setBusy(true);
      showMessage("Saving verified payment destination...");

      const response = await axios.post(
        API_BASE_URL + "/vendors/" + companyId,
        vendorData
      );

      const newVendorId = String(response.data.id);

      setVendorId(newVendorId);
      localStorage.setItem("trustshield_vendor_id", newVendorId);

      setSetupStep(3);
      showMessage("Trusted vendor saved successfully.");
    } catch (error) {
      showMessage(error.response?.data?.detail || "Vendor setup failed.");
    } finally {
      setBusy(false);
    }
  };

  const finishSetup = async () => {
    setScreen("app");
    setActiveTab("home");
    await refreshData();
  };

  const scanInvoice = async () => {
    try {
      if (!setupDone) {
        showMessage("Complete setup before scanning invoices.");
        setScreen("setup");
        return;
      }

      if (!invoiceFile) {
        showMessage("Please choose a PDF invoice first.");
        return;
      }

      if (!validateInvoiceFile(invoiceFile)) {
        setInvoiceFile(null);
        return;
      }

      if (!uploadConsent) {
        showMessage("Please confirm that you own this invoice or have permission to process it.");
        return;
      }

      setBusy(true);
      showMessage("Running payment fraud scan...");

      const formData = new FormData();
      formData.append("company_id", companyId);
      formData.append("vendor_id", vendorId);
      formData.append("file", invoiceFile);

      const response = await axios.post(
        API_BASE_URL + "/invoices/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setLatestScan(response.data);
      setInvoiceId(String(response.data.invoice_id));

      try {
        const explanationResponse = await axios.get(
          API_BASE_URL + "/invoices/explain/" + response.data.invoice_id
        );

        setAiExplanation(explanationResponse.data);
      } catch {
        setAiExplanation(null);
      }

      await refreshDataSilent(companyId);

      setActiveTab("result");
      showMessage("Invoice scanned successfully.");
    } catch (error) {
      showMessage(error.response?.data?.detail || "Invoice scan failed.");
    } finally {
      setBusy(false);
    }
  };

  const refreshDataSilent = async (id = companyId) => {
    if (!id) return;

    try {
      const summaryResponse = await axios.get(
        API_BASE_URL + "/invoices/summary/" + id
      );

      setSummary(summaryResponse.data);
    } catch {
      return;
    }

    try {
      const invoiceResponse = await axios.get(API_BASE_URL + "/invoices/" + id);

      setInvoices(invoiceResponse.data);
    } catch {
      return;
    }
  };

  const refreshData = async () => {
    if (!companyId) {
      showMessage("Create your business vault first.");
      return;
    }

    setBusy(true);
    showMessage("Refreshing account protection data...");

    await refreshDataSilent(companyId);

    setBusy(false);
    showMessage("Dashboard refreshed.");
  };

  const resetDemo = () => {
    localStorage.removeItem("trustshield_company_id");
    localStorage.removeItem("trustshield_vendor_id");

    setScreen("welcome");
    setActiveTab("home");
    setSetupStep(1);

    setCompanyId("");
    setVendorId("");
    setInvoiceId("");
    setInvoiceFile(null);
    setUploadConsent(false);
    setLatestScan(null);
    setAiExplanation(null);
    setSummary(null);
    setInvoices([]);

    setRegisterData({
      name: "Denish",
      email: `denish${Date.now()}@test.com`,
      password: "123456",
      company_name: "Denish Company",
    });

    showMessage("Demo reset.");
  };

  const totalInvoices = summary?.total_invoices ?? invoices.length;
  const lowRisk = summary?.low_risk ?? 0;
  const mediumRisk = summary?.medium_risk ?? 0;
  const highRisk = summary?.high_risk ?? 0;
  const totalAmount = summary?.total_amount ?? 0;

  const protectionScore =
    totalInvoices === 0
      ? 100
      : Math.max(0, 100 - highRisk * 30 - mediumRisk * 12);

  if (screen === "welcome") {
    return (
      <div className="ts-welcome-page">
        <header className="ts-public-nav">
          <div className="ts-brand">
            <img className="ts-logo" src="/logo.png" alt="TrustShield AI logo" />
            <div>
              <strong>TrustShield AI</strong>
              <span>AI payment security</span>
            </div>
          </div>

          <div className="ts-public-actions">
            <button className="ts-ghost-button" onClick={() => setScreen("setup")}>
              Try demo
            </button>
            <button onClick={() => setScreen("setup")}>Launch vault</button>
          </div>
        </header>

        <main className="ts-hero">
          <section className="ts-hero-copy">
            <span className="ts-pill">AI fraud protection for invoices</span>

            <h1>Stop risky invoice payments before money moves.</h1>

            <p>
              TrustShield AI verifies vendor identity, invoice details, duplicate
              records, and bank-account signals before your company approves a
              payment.
            </p>

            <div className="ts-hero-actions">
              <button onClick={() => setScreen("setup")}>Start secure demo</button>
              <button className="ts-ghost-button" onClick={() => setScreen("setup")}>
                View payment vault
              </button>
            </div>

            <div className="ts-trust-row">
              <div>
                <strong>PDF only</strong>
                <span>Safe upload flow</span>
              </div>
              <div>
                <strong>5 MB limit</strong>
                <span>Controlled scanning</span>
              </div>
              <div>
                <strong>No PDF storage</strong>
                <span>Extract and delete</span>
              </div>
            </div>
          </section>

          <section className="ts-hero-card">
            <div className="ts-card-header">
              <div>
                <span>Business vault</span>
                <strong>Payment risk center</strong>
              </div>
              <b>LIVE</b>
            </div>

            <div className="ts-score-card">
              <div>
                <span>Protection score</span>
                <strong>96</strong>
              </div>
              <p>Vendor profile verified</p>
            </div>

            <div className="ts-payment-list">
              <div className="ts-payment safe">
                <span className="ts-dot"></span>
                <div>
                  <strong>Alpha Supplies</strong>
                  <p>Bank account matched</p>
                </div>
                <b>SAFE</b>
              </div>

              <div className="ts-payment review">
                <span className="ts-dot"></span>
                <div>
                  <strong>New invoice</strong>
                  <p>Manual review suggested</p>
                </div>
                <b>REVIEW</b>
              </div>

              <div className="ts-payment danger">
                <span className="ts-dot"></span>
                <div>
                  <strong>Unknown IBAN</strong>
                  <p>Payment blocked</p>
                </div>
                <b>BLOCKED</b>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (screen === "setup") {
    return (
      <div className="ts-setup-page">
        <div className="ts-setup-shell">
          <aside className="ts-setup-left">
            <div className="ts-brand light">
              <img className="ts-logo" src="/logo.png" alt="TrustShield AI logo" />
              <div>
                <strong>TrustShield AI</strong>
                <span>Secure setup</span>
              </div>
            </div>

            <h1>Create your invoice protection vault.</h1>

            <p>
              Set up your company profile and one trusted vendor. Then scan
              invoices before approving payment.
            </p>

            <div className="ts-setup-progress">
              <div className={setupStep >= 1 ? "complete" : ""}>
                <span>1</span>
                <p>Business vault</p>
              </div>

              <div className={setupStep >= 2 ? "complete" : ""}>
                <span>2</span>
                <p>Trusted vendor</p>
              </div>

              <div className={setupStep >= 3 ? "complete" : ""}>
                <span>3</span>
                <p>Ready to scan</p>
              </div>
            </div>
          </aside>

          <main className="ts-setup-card">
            {message && <div className="ts-toast">{message}</div>}

            {setupStep === 1 && (
              <>
                <span className="ts-pill">Step 1</span>

                <h2>Create business vault</h2>

                <p className="ts-form-intro">
                  Your vault stores trusted vendor data and scanned invoice
                  history.
                </p>

                <div className="ts-form-grid">
                  <label>
                    Your name
                    <input
                      value={registerData.name}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          name: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Company name
                    <input
                      value={registerData.company_name}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          company_name: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Email
                    <input
                      value={registerData.email}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          email: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      value={registerData.password}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          password: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <button className="ts-wide-button" onClick={createWorkspace} disabled={busy}>
                  {busy ? "Creating..." : "Create vault"}
                </button>
              </>
            )}

            {setupStep === 2 && (
              <>
                <span className="ts-pill">Step 2</span>

                <h2>Add trusted vendor</h2>

                <p className="ts-form-intro">
                  Future invoices will be checked against this verified payment
                  destination.
                </p>

                <div className="ts-form-grid">
                  <label>
                    Vendor name
                    <input
                      value={vendorData.vendor_name}
                      onChange={(e) =>
                        setVendorData({
                          ...vendorData,
                          vendor_name: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Email domain
                    <input
                      value={vendorData.official_email_domain}
                      onChange={(e) =>
                        setVendorData({
                          ...vendorData,
                          official_email_domain: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="full-width">
                    Trusted bank account
                    <input
                      value={vendorData.trusted_bank_account}
                      onChange={(e) =>
                        setVendorData({
                          ...vendorData,
                          trusted_bank_account: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Phone
                    <input
                      value={vendorData.trusted_phone}
                      onChange={(e) =>
                        setVendorData({
                          ...vendorData,
                          trusted_phone: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Tax ID
                    <input
                      value={vendorData.tax_id}
                      onChange={(e) =>
                        setVendorData({
                          ...vendorData,
                          tax_id: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="full-width">
                    Address
                    <input
                      value={vendorData.address}
                      onChange={(e) =>
                        setVendorData({
                          ...vendorData,
                          address: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <button className="ts-wide-button" onClick={saveVendor} disabled={busy}>
                  {busy ? "Saving..." : "Save trusted vendor"}
                </button>
              </>
            )}

            {setupStep === 3 && (
              <div className="ts-ready-card">
                <div className="ts-ready-icon">
                  <CheckCircle2 className="icon" />
                </div>

                <h2>Protection vault ready</h2>

                <p>
                  TrustShield AI is now ready to scan invoices and protect your
                  business payments.
                </p>

                <button className="ts-wide-button" onClick={finishSetup}>
                  Enter app
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="ts-app">
      <main className="ts-main">
        <header className="ts-topbar">
          <div className="ts-topbar-brand">
            <img className="ts-logo small" src="/logo.png" alt="TrustShield AI logo" />
            <div>
              <span>
                {activeTab === "home" && "Secure dashboard"}
                {activeTab === "scan" && "Invoice scanner"}
                {activeTab === "result" && "Payment decision"}
                {activeTab === "activity" && "Audit history"}
              </span>

              <h1>
                {activeTab === "home" && "Payment protection vault"}
                {activeTab === "scan" && "Scan invoice"}
                {activeTab === "result" && "Latest decision"}
                {activeTab === "activity" && "Invoice activity"}
              </h1>
            </div>
          </div>

          <div className="ts-topbar-actions">
            <button className="ts-reset-top" onClick={resetDemo}>
              <RotateCcw className="icon" />
              Reset
            </button>
            <button onClick={refreshData} disabled={busy}>
              <RefreshCw className="icon" style={busy ? { animation: "spin 0.9s linear infinite" } : undefined} />
              {busy ? "Syncing..." : "Sync"}
            </button>
          </div>
        </header>

        {message && <div className="ts-toast">{message}</div>}

        {activeTab === "home" && (
          <section className="ts-page">
            <div className="ts-dashboard-hero">
              <div>
                <span className="ts-pill">AI protection active</span>

                <h2>
                  {highRisk > 0
                    ? "High-risk payment detected"
                    : mediumRisk > 0
                    ? "Some invoices need review"
                    : "Your payment flow looks safe"}
                </h2>

                <p>
                  TrustShield AI checks invoices against trusted vendor records
                  and highlights risky payment signals before approval.
                </p>

                <button onClick={() => setActiveTab("scan")}>
                  Scan new invoice
                </button>
              </div>

              <VaultDial
                value={protectionScore}
                size={158}
                label="Protection"
                status={
                  highRisk > 0 ? "blocked" : mediumRisk > 0 ? "review" : "safe"
                }
              />
            </div>

            <div className="ts-metrics">
              <div className="ts-metric-card">
                <div className="ts-metric-top">
                  <span>Total scanned</span>
                  <div className="ts-metric-icon">
                    <FileText className="icon" />
                  </div>
                </div>
                <strong>{totalInvoices}</strong>
                <p>Invoices checked</p>
              </div>

              <div className="ts-metric-card safe">
                <div className="ts-metric-top">
                  <span>Safe</span>
                  <div className="ts-metric-icon">
                    <ShieldCheck className="icon" />
                  </div>
                </div>
                <strong>{lowRisk}</strong>
                <p>Low-risk payments</p>
              </div>

              <div className="ts-metric-card review">
                <div className="ts-metric-top">
                  <span>Review</span>
                  <div className="ts-metric-icon">
                    <ShieldAlert className="icon" />
                  </div>
                </div>
                <strong>{mediumRisk}</strong>
                <p>Need manual check</p>
              </div>

              <div className="ts-metric-card blocked">
                <div className="ts-metric-top">
                  <span>Blocked</span>
                  <div className="ts-metric-icon">
                    <ShieldX className="icon" />
                  </div>
                </div>
                <strong>{highRisk}</strong>
                <p>Fraud signals</p>
              </div>
            </div>

            <div className="ts-value-panel">
              <div>
                <span>Protected invoice value</span>
                <strong>€{totalAmount}</strong>
              </div>

              <p>
                Total value of invoices scanned through your TrustShield payment
                security vault.
              </p>
            </div>
          </section>
        )}

        {activeTab === "scan" && (
          <section className="ts-page">
            <div className="ts-scan-grid">
              <div className="ts-scan-panel">
                <span className="ts-pill">Secure PDF scan</span>

                <h2>Verify invoice before payment</h2>

                <p>
                  Upload an invoice PDF. TrustShield checks vendor name, invoice
                  number, amount, due date, and bank account against your trusted
                  vendor profile.
                </p>

                <label className="ts-upload-box">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const selectedFile = e.target.files[0];

                      if (!selectedFile) {
                        setInvoiceFile(null);
                        return;
                      }

                      if (!validateInvoiceFile(selectedFile)) {
                        setInvoiceFile(null);
                        e.target.value = "";
                        return;
                      }

                      setInvoiceFile(selectedFile);
                    }}
                  />

                  <div className="ts-upload-icon">
                    <UploadCloud className="icon" />
                  </div>

                  <strong>
                    {invoiceFile ? invoiceFile.name : "Choose invoice PDF"}
                  </strong>

                  <span>PDF only · Maximum 5 MB · Original file deleted after scan</span>
                </label>

                <label className="ts-consent-box">
                  <input
                    type="checkbox"
                    checked={uploadConsent}
                    onChange={(e) => setUploadConsent(e.target.checked)}
                  />
                  <span>
                    I confirm I own this invoice or have permission to process it.
                  </span>
                </label>

                <button
                  className="ts-scan-button"
                  onClick={scanInvoice}
                  disabled={busy}
                >
                  {busy ? "Scanning..." : "Scan invoice"}
                </button>
              </div>

              <div className={"ts-decision-preview " + riskClass(latestScan?.risk_level)}>
                <span>Payment decision</span>

                <h2>{paymentDecision(latestScan?.risk_level)}</h2>

                <p>{paymentDecisionText(latestScan?.risk_level)}</p>

                <div className="ts-risk-score">
                  <VaultDial
                    value={latestScan?.risk_score ?? 0}
                    size={120}
                    label="Risk score"
                    status={dialStatus(latestScan?.risk_level)}
                    onDark
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "result" && (
          <section className="ts-page">
            {!latestScan ? (
              <div className="ts-empty-card">
                <div className="ts-empty-icon">
                  <Inbox className="icon" />
                </div>
                <h2>No invoice scanned yet</h2>
                <p>Scan an invoice first to see payment approval status.</p>
                <button onClick={() => setActiveTab("scan")}>Scan invoice</button>
              </div>
            ) : (
              <>
                <div className={"ts-result-card " + riskClass(latestScan.risk_level)}>
                  <div>
                    <span>Latest payment decision</span>
                    <h2>{paymentDecision(latestScan.risk_level)}</h2>
                    <p>{paymentDecisionText(latestScan.risk_level)}</p>
                  </div>

                  <div className="ts-result-score">
                    <VaultDial
                      value={latestScan.risk_score}
                      size={132}
                      label="Score"
                      status={dialStatus(latestScan.risk_level)}
                      onDark
                    />
                  </div>
                </div>

                <div className="ts-detail-grid">
                  <div>
                    <span>Vendor</span>
                    <strong>{latestScan.extracted_vendor_name || "-"}</strong>
                  </div>

                  <div>
                    <span>Invoice number</span>
                    <strong>{latestScan.invoice_number || "-"}</strong>
                  </div>

                  <div>
                    <span>Amount</span>
                    <strong>
                      {latestScan.amount || 0} {latestScan.currency || ""}
                    </strong>
                  </div>

                  <div>
                    <span>Bank account</span>
                    <strong>{latestScan.extracted_bank_account || "-"}</strong>
                  </div>
                </div>

                {aiExplanation && (
                  <div className="ts-ai-panel">
                    <span className="ts-pill">AI payment analyst</span>

                    <h2>{aiExplanation.summary}</h2>

                    <ul>
                      {aiExplanation.explanation?.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>

                    <div className="ts-recommendation">
                      <strong>Recommendation</strong>
                      <p>{aiExplanation.recommendation}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {activeTab === "activity" && (
          <section className="ts-page">
            <div className="ts-activity-panel">
              {invoices.length === 0 ? (
                <div className="ts-empty-card flat">
                  <div className="ts-empty-icon">
                    <Inbox className="icon" />
                  </div>
                  <h2>No activity yet</h2>
                  <p>Your scanned invoices will appear here.</p>
                  <button onClick={() => setActiveTab("scan")}>
                    Scan invoice
                  </button>
                </div>
              ) : (
                invoices.map((invoice) => (
                  <div className="ts-activity-item" key={invoice.id}>
                    <div className="ts-file-icon">
                      <FileText className="icon" />
                    </div>

                    <div>
                      <strong>{invoice.invoice_number || "Invoice"}</strong>
                      <p>{invoice.extracted_vendor_name || "Unknown vendor"}</p>
                    </div>

                    <div>
                      <strong>
                        {invoice.amount || 0} {invoice.currency || ""}
                      </strong>
                      <p>{invoice.due_date || "No due date"}</p>
                    </div>

                    <span className={"ts-risk-chip " + riskClass(invoice.risk_level)}>
                      {invoice.risk_level || "UNKNOWN"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      <nav className="ts-bottom-nav">
        <button
          className={activeTab === "home" ? "active" : ""}
          onClick={() => setActiveTab("home")}
        >
          <Home className="icon" />
          Home
        </button>

        <button
          className={activeTab === "scan" ? "active" : ""}
          onClick={() => setActiveTab("scan")}
        >
          <ScanLine className="icon" />
          Scan
        </button>

        <button
          className={activeTab === "result" ? "active" : ""}
          onClick={() => setActiveTab("result")}
        >
          <FileCheck2 className="icon" />
          Result
        </button>

        <button
          className={activeTab === "activity" ? "active" : ""}
          onClick={() => setActiveTab("activity")}
        >
          <History className="icon" />
          Activity
        </button>
      </nav>
    </div>
  );
}

export default App;
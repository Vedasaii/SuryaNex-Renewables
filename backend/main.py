import json
import os
import uuid
import smtplib
import sqlite3
from datetime import datetime
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import FastAPI, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

app = FastAPI(
    title="SuryaNex Renewables - Leads API",
    description="Microservice to capture and log customer solar quotes and site survey inquiries",
    version="1.0.0"
)

# Enable CORS for frontend integration (null is for double-clicked local files, * allows standard dev hosts)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schema for Quote submissions
class SolarQuoteRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, example="Rama Krishna")
    phone: str = Field(..., pattern=r"^[6-9]\d{9}$", example="9962324677")
    email: Optional[str] = Field(None, example="rama@gmail.com")
    bill_estimate: Optional[str] = Field(None, example="₹5,000 / month")
    sector: str = Field(..., example="residential")
    capacity_estimate: Optional[str] = Field(None, example="3.0 kW System")
    message: Optional[str] = Field(None, example="Rooftop is flat shadow-free concrete roof.")

DB_FILE = os.path.join(os.path.dirname(__file__), "leads.db")

# Helper to initialize and run data migrations from JSON if exists
def init_db():
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS leads (
                id TEXT PRIMARY KEY,
                timestamp TEXT,
                name TEXT,
                phone TEXT,
                email TEXT,
                bill_estimate TEXT,
                sector TEXT,
                capacity_estimate TEXT,
                message TEXT
            )
        """)
        conn.commit()
        
        # Legacy migration check
        legacy_json = os.path.join(os.path.dirname(DB_FILE), "submissions.json")
        if os.path.exists(legacy_json):
            print("Found legacy JSON database. Migrating records to SQLite...")
            try:
                with open(legacy_json, "r", encoding="utf-8") as f:
                    legacy_data = json.load(f)
                for item in legacy_data:
                    cursor.execute("""
                        INSERT OR IGNORE INTO leads (id, timestamp, name, phone, email, bill_estimate, sector, capacity_estimate, message)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        item.get("id"),
                        item.get("timestamp"),
                        item.get("name"),
                        item.get("phone"),
                        item.get("email"),
                        item.get("bill_estimate"),
                        item.get("sector"),
                        item.get("capacity_estimate"),
                        item.get("message")
                    ))
                conn.commit()
                # Rename the file to prevent repeating migration
                os.rename(legacy_json, legacy_json + ".backup")
                print("Migration completed successfully. Legacy data backed up to submissions.json.backup")
            except Exception as e:
                print(f"Error during legacy migration: {e}")
        conn.close()
    except Exception as e:
        print(f"Error initializing SQLite database: {e}")

# Call DB initialization
init_db()

# Helper to read SQLite database
def load_db() -> list:
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id, timestamp, name, phone, email, bill_estimate, sector, capacity_estimate, message FROM leads ORDER BY timestamp DESC")
        rows = cursor.fetchall()
        leads = []
        for row in rows:
            leads.append(dict(row))
        conn.close()
        return leads
    except Exception as e:
        print(f"Error loading from SQLite: {e}")
        return []

def save_lead(lead_data: dict) -> bool:
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO leads (id, timestamp, name, phone, email, bill_estimate, sector, capacity_estimate, message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            lead_data["id"],
            lead_data["timestamp"],
            lead_data["name"],
            lead_data["phone"],
            lead_data["email"],
            lead_data["bill_estimate"],
            lead_data["sector"],
            lead_data["capacity_estimate"],
            lead_data["message"]
        ))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error saving lead to SQLite: {e}")
        return False

# Email Alert Configuration for Leads (Gmail SMTP)
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "suryanexrenewables@gmail.com")
# Set this env variable locally or on hosting platform to enable email notifications
SENDER_PASSWORD = os.environ.get("SENDER_PASSWORD", "")
RECEIVER_EMAIL = "suryanexrenewables@gmail.com"

def send_email_lead(lead_data: dict):
    if not SENDER_PASSWORD:
        print("\n⚠️  SMTP Warning: 'SENDER_PASSWORD' environment variable is not set.")
        print("   Skipping email notification. Set SENDER_PASSWORD to send lead notifications via email.\n")
        return False
    try:
        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = RECEIVER_EMAIL
        msg["Subject"] = f"🔥 New Solar Lead: {lead_data['name']} [{lead_data['id']}]"
        
        body = f"""
☀️ NEW SOLAR LEAD CAPTURED ☀️
--------------------------------------------------
Lead ID:           {lead_data['id']}
Timestamp:         {lead_data['timestamp']}
Name:              {lead_data['name']}
Phone:             {lead_data['phone']}
Email:             {lead_data['email'] or 'N/A'}
Sector:            {lead_data['sector'].upper()}
Estimated Bill:    {lead_data['bill_estimate'] or 'N/A'}
Estimated Capacity: {lead_data['capacity_estimate'] or 'N/A'}

Message / Special Requirements:
{lead_data['message'] or 'No custom message.'}
--------------------------------------------------
This is an automated notification from SuryaNex Renewables API server.
"""
        msg.attach(MIMEText(body, "plain"))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, RECEIVER_EMAIL, msg.as_string())
        server.quit()
        print(f"📨 Lead notification email successfully dispatched to {RECEIVER_EMAIL}!")
        return True
    except Exception as e:
        print(f"❌ Failed to dispatch lead notification email: {e}")
        return False

@app.post("/api/quote", status_code=status.HTTP_201_CREATED)
async def create_quote_request(payload: SolarQuoteRequest):
    lead_id = f"SN-{uuid.uuid4().hex[:6].upper()}"
    timestamp = datetime.now().isoformat()
    
    lead_data = {
        "id": lead_id,
        "timestamp": timestamp,
        "name": payload.name,
        "phone": payload.phone,
        "email": payload.email,
        "bill_estimate": payload.bill_estimate,
        "sector": payload.sector,
        "capacity_estimate": payload.capacity_estimate,
        "message": payload.message
    }
    
    # Save to SQLite DB
    save_lead(lead_data)
    
    # Send email notification alerts
    send_email_lead(lead_data)
    
    # Highlight lead details in terminal
    print("\n" + "="*50)
    print(f"☀️ NEW SOLAR LEAD CAPTURED [{lead_id}] ☀️")
    print(f"Time:        {timestamp}")
    print(f"Name:        {payload.name}")
    print(f"Phone:       {payload.phone}")
    print(f"Email:       {payload.email or 'N/A'}")
    print(f"Sector:      {payload.sector.upper()}")
    print(f"Est Bill:    {payload.bill_estimate or 'N/A'}")
    print(f"Est System:  {payload.capacity_estimate or 'N/A'}")
    print(f"Message:     {payload.message or 'N/A'}")
    print("="*50 + "\n")
    
    return {
        "status": "success",
        "message": "Lead captured successfully",
        "id": lead_id
    }

@app.get("/api/quotes")
async def get_all_quotes(x_admin_password: Optional[str] = Header(None)):
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    if x_admin_password != admin_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized admin access"
        )
    return load_db()

@app.delete("/api/quote/{lead_id}")
async def delete_quote(lead_id: str, x_admin_password: Optional[str] = Header(None)):
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    if x_admin_password != admin_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized admin access"
        )
    # Delete from SQLite DB
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
        rows_affected = cursor.rowcount
        conn.commit()
        conn.close()
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Lead not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting lead from SQLite: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    return {"status": "success", "message": f"Lead {lead_id} deleted successfully"}

@app.get("/admin")
async def redirect_to_admin():
    return RedirectResponse(url="/admin.html")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "SuryaNex API"}

# Mount static directory to serve index.html at root "/"
app.mount("/", StaticFiles(directory="../", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

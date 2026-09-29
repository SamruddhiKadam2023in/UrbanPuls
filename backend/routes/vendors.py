import csv
import io
from datetime import date, datetime, time, timedelta
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import hash_password, require_roles, validate_password
from core.timeutil import utcnow, to_local, LOCAL_TZ
from models.booking import Booking, BookingStatus, PaymentMethod
from models.parking import ParkingZone
from models.user import User, UserRole
from schemas import UserOut
from services import booking_service as bs
from services.pdf_service import generate_report_pdf

router = APIRouter()
vendor_or_admin = require_roles(UserRole.vendor, UserRole.admin)

def _scope(q, db: Session, user: User):
    """Limits a Booking query to the caller's zones (admins see everything)."""
    if user.role == UserRole.admin:
        return q
    zone_ids = [z.id for z in db.query(ParkingZone.id).filter(ParkingZone.vendor_id == user.id).all()]
    return q.filter(Booking.zone_id.in_(zone_ids))

@router.get("/stats")
def vendor_stats(db: Session = Depends(get_db), user: User = Depends(vendor_or_admin)):
    zones_q = db.query(ParkingZone)
    if user.role != UserRole.admin:
        zones_q = zones_q.filter(ParkingZone.vendor_id == user.id)
    total_zones = zones_q.count()

    bookings = _scope(db.query(Booking), db, user)
    total_bookings = bookings.count()
    revenue = _scope(db.query(func.coalesce(func.sum(Booking.final_amount), 0.0))
                     .filter(Booking.status == BookingStatus.completed), db, user).scalar()
    parked_now = bookings.filter(Booking.status == BookingStatus.checked_in).count()
    no_shows = bookings.filter(Booking.status == BookingStatus.no_show).count()
    return {"total_zones": total_zones, "total_bookings": total_bookings, "total_revenue": float(revenue or 0),
            "parked_now": parked_now, "no_shows": no_shows}

@router.get("/trend")
def booking_trend(days: int = 7, db: Session = Depends(get_db), user: User = Depends(vendor_or_admin)):
    """Bookings created and revenue collected per local day."""
    days = max(1, min(days, 90))
    today = to_local(utcnow()).date()
    buckets = {today - timedelta(days=i): {"bookings": 0, "revenue": 0.0} for i in range(days - 1, -1, -1)}
    since = utcnow() - timedelta(days=days + 1)

    for b in _scope(db.query(Booking).filter(Booking.created_at >= since), db, user).all():
        day = to_local(b.created_at).date()
        if day in buckets:
            buckets[day]["bookings"] += 1
    for b in _scope(db.query(Booking).filter(Booking.status == BookingStatus.completed,
                                             Booking.checked_out_at >= since), db, user).all():
        day = to_local(b.checked_out_at).date()
        if day in buckets:
            buckets[day]["revenue"] += b.final_amount or 0

    return [{"date": d.isoformat(), "day": d.strftime("%a"), "bookings": v["bookings"],
             "revenue": round(v["revenue"], 2)} for d, v in buckets.items()]

# ── Occupancy ─────────────────────────────────────────────────────────────────
@router.get("/occupancy")
def occupancy(db: Session = Depends(get_db), user: User = Depends(vendor_or_admin)):
    """Current state of every slot in the caller's zones."""
    zones_q = db.query(ParkingZone)
    if user.role != UserRole.admin:
        zones_q = zones_q.filter(ParkingZone.vendor_id == user.id)
    zones = zones_q.order_by(ParkingZone.id).all()
    held = bs.held_slot_ids_now(db, [z.id for z in zones]) if zones else set()
    out = []
    for z in zones:
        active = [s for s in z.slots if s.is_active]
        parked = sum(1 for s in active if s.is_occupied)
        reserved = sum(1 for s in active if not s.is_occupied and s.id in held)
        total = len(active)
        out.append({"zone_id": z.id, "zone_name": z.name, "is_active": z.is_active, "total": total,
                    "parked": parked, "reserved": reserved, "free": total - parked - reserved,
                    "occupancy_pct": round((parked + reserved) / total * 100) if total else 0})
    return out

# ── Revenue reports ───────────────────────────────────────────────────────────
REPORT_COLUMNS = [
    ("period", "Period"), ("reservations", "Reservations"), ("walk_ins", "Walk-ins"),
    ("completed", "Completed"), ("no_shows", "No-shows"), ("cancelled", "Cancelled"),
    ("cash", "Cash (Rs)"), ("upi", "UPI (Rs)"), ("discounts", "Points discount (Rs)"), ("revenue", "Revenue (Rs)"),
]

def _bucket(d: date, period: str) -> date:
    if period == "week":
        return d - timedelta(days=d.weekday())
    if period == "month":
        return d.replace(day=1)
    return d

def _label(d: date, period: str) -> str:
    if period == "week":
        return f"Week of {d.strftime('%d %b %Y')}"
    if period == "month":
        return d.strftime("%b %Y")
    return d.strftime("%d %b %Y")

@router.get("/report")
def revenue_report(period: Literal["day", "week", "month"] = "day",
                   start: Optional[date] = None, end: Optional[date] = None,
                   zone_id: Optional[int] = None, format: Literal["json", "csv", "pdf"] = "json",
                   db: Session = Depends(get_db), user: User = Depends(vendor_or_admin)):
    today = to_local(utcnow()).date()
    end = end or today
    start = start or end - timedelta(days=29)
    if start > end:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    if (end - start).days > 366:
        raise HTTPException(status_code=400, detail="Reports can cover at most one year")

    # Local-day boundaries converted to UTC for the query
    since = datetime.combine(start, time.min, LOCAL_TZ)
    until = datetime.combine(end + timedelta(days=1), time.min, LOCAL_TZ)

    q = _scope(db.query(Booking), db, user)
    if zone_id is not None:
        if user.role != UserRole.admin and not db.query(ParkingZone.id).filter(
                ParkingZone.id == zone_id, ParkingZone.vendor_id == user.id).first():
            raise HTTPException(status_code=403, detail="This zone belongs to another Parking Partner")
        q = q.filter(Booking.zone_id == zone_id)

    rows: dict[date, dict] = {}
    def row(d: date) -> dict:
        key = _bucket(d, period)
        return rows.setdefault(key, {k: 0 for k, _ in REPORT_COLUMNS[1:]})

    for b in q.filter(Booking.created_at >= since, Booking.created_at < until).all():
        r = row(to_local(b.created_at).date())
        if b.is_walk_in:
            r["walk_ins"] += 1
        else:
            r["reservations"] += 1
        if b.status == BookingStatus.no_show:
            r["no_shows"] += 1
        elif b.status == BookingStatus.cancelled:
            r["cancelled"] += 1
    for b in q.filter(Booking.status == BookingStatus.completed,
                      Booking.checked_out_at >= since, Booking.checked_out_at < until).all():
        r = row(to_local(b.checked_out_at).date())
        r["completed"] += 1
        amount = b.final_amount or 0
        r["revenue"] += amount
        r["discounts"] += b.discount_amount or 0
        if b.payment_method == PaymentMethod.cash:
            r["cash"] += amount
        elif b.payment_method == PaymentMethod.upi:
            r["upi"] += amount

    data = []
    for key in sorted(rows):
        r = rows[key]
        data.append({"period": _label(key, period), "start": key.isoformat(),
                     **{k: round(v, 2) if isinstance(v, float) else v for k, v in r.items()}})
    totals = {k: round(sum(r[k] for r in data), 2) for k, _ in REPORT_COLUMNS[1:]}

    filename = f"urbanpuls_report_{period}_{start}_{end}"
    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow([h for _, h in REPORT_COLUMNS])
        for r in data:
            w.writerow([r[k] for k, _ in REPORT_COLUMNS])
        w.writerow(["Total", *[totals[k] for k, _ in REPORT_COLUMNS[1:]]])
        return Response(buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'})
    if format == "pdf":
        zone_name = db.get(ParkingZone, zone_id).name if zone_id else ("All zones" if user.role == UserRole.admin else "All your zones")
        pdf = generate_report_pdf(
            f"UrbanPuls revenue report ({period})", f"{zone_name} · {start.strftime('%d %b %Y')} to {end.strftime('%d %b %Y')}",
            [h for _, h in REPORT_COLUMNS],
            [[r[k] for k, _ in REPORT_COLUMNS] for r in data] + [["Total", *[totals[k] for k, _ in REPORT_COLUMNS[1:]]]],
        )
        return Response(pdf, media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'})
    return {"period": period, "start": start, "end": end, "rows": data, "totals": totals}


# ── Parking Partner home ──────────────────────────────────────────────────────
@router.get("/today")
def today_summary(db: Session = Depends(get_db), user: User = Depends(vendor_or_admin)):
    """Everything a Parking Partner needs at a glance: today's takings, cars in, arrivals, lot setup issues."""
    now = utcnow()
    today = to_local(now).date()
    since = datetime.combine(today, time.min, LOCAL_TZ)

    zones_q = db.query(ParkingZone)
    if user.role != UserRole.admin:
        zones_q = zones_q.filter(ParkingZone.vendor_id == user.id)
    zones = zones_q.order_by(ParkingZone.id).all()

    bookings = _scope(db.query(Booking), db, user)
    done = bookings.filter(Booking.status == BookingStatus.completed, Booking.checked_out_at >= since).all()
    created = bookings.filter(Booking.created_at >= since).all()
    no_shows = bookings.filter(Booking.status == BookingStatus.no_show, Booking.start_time >= since).count()
    arriving = bookings.filter(Booking.status == BookingStatus.reserved,
                               Booking.start_time <= now + timedelta(hours=2)).order_by(Booking.start_time).limit(10).all()

    held = bs.held_slot_ids_now(db, [z.id for z in zones]) if zones else set()
    lots = []
    for z in zones:
        active = [s for s in z.slots if s.is_active]
        parked = sum(1 for s in active if s.is_occupied)
        reserved = sum(1 for s in active if not s.is_occupied and s.id in held)
        lots.append({"zone_id": z.id, "name": z.name, "is_active": z.is_active, "total": len(active),
                     "parked": parked, "reserved": reserved, "free": len(active) - parked - reserved})

    issues = []
    for z in zones:
        if not z.upi_id:
            issues.append({"zone_id": z.id, "zone": z.name, "issue": "no_upi"})
        if not z.is_active:
            issues.append({"zone_id": z.id, "zone": z.name, "issue": "hidden"})

    cash = sum(b.final_amount or 0 for b in done if b.payment_method == PaymentMethod.cash)
    upi = sum(b.final_amount or 0 for b in done if b.payment_method == PaymentMethod.upi)
    return {
        "date": today.isoformat(),
        "totals": {
            "revenue": round(cash + upi, 2), "cash": round(cash, 2), "upi": round(upi, 2),
            "completed": len(done),
            "reservations": sum(1 for b in created if not b.is_walk_in),
            "walk_ins": sum(1 for b in created if b.is_walk_in),
            "no_shows": no_shows,
        },
        "parked_now": sum(l["parked"] for l in lots),
        "free_now": sum(l["free"] for l in lots),
        "arriving": [{"id": b.id, "vehicle_number": b.vehicle_number, "zone_id": b.zone_id, "zone_name": b.zone.name,
                      "slot_number": b.slot.slot_number, "start_time": b.start_time} for b in arriving],
        "lots": lots,
        "issues": issues,
    }


# ── Gate staff (attendants) ───────────────────────────────────────────────────
partner_only = require_roles(UserRole.vendor)

class StaffCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str
    phone: Optional[str] = None

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validate_password(v)

class StaffUpdate(BaseModel):
    is_active: Optional[bool] = None
    password: Optional[str] = None      # partner sets a new temporary password

    @field_validator("password")
    @classmethod
    def _password(cls, v: Optional[str]) -> Optional[str]:
        return validate_password(v) if v is not None else v

def _own_staff(db: Session, partner: User, staff_id: int) -> User:
    staff = db.query(User).filter(User.id == staff_id, User.employer_id == partner.id,
                                  User.role == UserRole.attendant).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff

@router.get("/staff", response_model=list[UserOut])
def list_staff(db: Session = Depends(get_db), partner: User = Depends(partner_only)):
    return db.query(User).filter(User.employer_id == partner.id, User.role == UserRole.attendant) \
        .order_by(User.created_at.desc()).all()

@router.post("/staff", status_code=201, response_model=UserOut)
def create_staff(data: StaffCreate, db: Session = Depends(get_db), partner: User = Depends(partner_only)):
    """Gate attendants sign in with their own account and can only use the Gate screen for this partner's lots."""
    email = data.email.lower()
    if db.query(User.id).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    staff = User(name=data.name.strip(), email=email, phone=data.phone, role=UserRole.attendant,
                 employer_id=partner.id, hashed_password=hash_password(data.password), email_verified=True)
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff

@router.patch("/staff/{staff_id}", response_model=UserOut)
def update_staff(staff_id: int, data: StaffUpdate, db: Session = Depends(get_db), partner: User = Depends(partner_only)):
    staff = _own_staff(db, partner, staff_id)
    if data.is_active is not None:
        staff.is_active = data.is_active
    if data.password is not None:
        staff.hashed_password = hash_password(data.password)   # also signs them out everywhere
    db.commit()
    db.refresh(staff)
    return staff

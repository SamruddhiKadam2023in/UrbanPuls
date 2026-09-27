from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.units import cm

from core.config import settings
from core.timeutil import utcnow, fmt_local

# The built-in PDF fonts have no rupee glyph, so amounts are written as "Rs."
def _rs(amount: float | None) -> str:
    return f"Rs. {amount or 0:.2f}"

def _build(path, title: str, accent: str, label_bg: str, label_fg: str, grid: str, stripe: str,
           rows: list[list[str]], footer: str) -> None:
    doc = SimpleDocTemplate(str(path), pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Heading1"], textColor=colors.HexColor(accent), fontSize=20, alignment=1)
    table = Table(rows, colWidths=[6*cm, 10*cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor(label_bg)),
        ("TEXTCOLOR",  (0, 0), (0, -1), colors.HexColor(label_fg)),
        ("FONTNAME",   (0, 0), (0, -1), "Helvetica-Bold"),
        ("GRID",       (0, 0), (-1, -1), 0.5, colors.HexColor(grid)),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor(stripe)]),
        ("PADDING",    (0, 0), (-1, -1), 8),
    ]))
    doc.build([
        Paragraph(title, title_style), Spacer(1, 0.5*cm),
        HRFlowable(width="100%", thickness=1, color=colors.HexColor(accent)), Spacer(1, 0.5*cm),
        table, Spacer(1, 1*cm),
        Paragraph(footer, styles["Normal"]),
    ])

def generate_receipt(booking, zone, slot, customer_name: str) -> str:
    settings.receipts_dir.mkdir(parents=True, exist_ok=True)
    path = settings.receipts_dir / f"receipt_{booking.id}_{int(utcnow().timestamp())}.pdf"
    rows = [
        ["Receipt No.",   f"TPMS-{booking.id:06d}"],
        ["Booking Code",  booking.booking_code],
        ["Customer",      customer_name],
        ["Vehicle No.",   booking.vehicle_number],
        ["Parking Zone",  zone.name],
        ["Address",       zone.address],
        ["Slot",          slot.slot_number],
        ["Checked In",    fmt_local(booking.checked_in_at)],
        ["Checked Out",   fmt_local(booking.checked_out_at)],
        ["Rate",          f"{_rs(booking.price_per_hour)} per hour"],
        ["Parking Fee",   _rs((booking.final_amount or 0) + (booking.discount_amount or 0))],
        ["Points Discount", f"- {_rs(booking.discount_amount)} ({booking.points_redeemed} points)"],
        ["Amount Paid",   _rs(booking.final_amount)],
        ["Payment Method", booking.payment_method.value.upper() if booking.payment_method else "N/A"],
        ["Issued At",     fmt_local(utcnow())],
    ]
    _build(path, "TPMS - Parking Receipt", "#1D9E75", "#E1F5EE", "#085041", "#5DCAA5", "#F5FEFB",
           rows, "Payment collected at the parking gate. Thank you for using TPMS. Drive safe!")
    return str(path)

def generate_fine_pdf(complaint) -> str:
    settings.fines_dir.mkdir(parents=True, exist_ok=True)
    path = settings.fines_dir / f"fine_{complaint.id}_{int(utcnow().timestamp())}.pdf"
    rows = [
        ["Fine No.",       f"FINE-{complaint.id:06d}"],
        ["Complaint Type", complaint.complaint_type.value.replace("_", " ").title()],
        ["Location",       f"{complaint.latitude}, {complaint.longitude}"],
        ["Description",    complaint.description or "N/A"],
        ["Status",         complaint.status.value.upper()],
        ["Reported At",    fmt_local(complaint.created_at)],
        ["Photo Evidence", "Attached" if complaint.photo_url else "None"],
        ["Fine Amount",    _rs(500)],
        ["Issued By",      "TPMS"],
    ]
    _build(path, "TPMS - Traffic Violation Fine", "#D85A30", "#FAECE7", "#712B13", "#F0997B", "#FFFAF8",
           rows, "This fine was generated after the complaint was verified by a TPMS administrator.")
    return str(path)

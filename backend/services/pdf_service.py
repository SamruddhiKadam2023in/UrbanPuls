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
        ["Receipt No.",   f"UP-{booking.id:06d}"],
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
    _build(path, "UrbanPuls - Parking Receipt", "#1D9E75", "#E1F5EE", "#085041", "#5DCAA5", "#F5FEFB",
           rows, "Payment collected at the parking gate. Thank you for using UrbanPuls. Drive safe!")
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
        ["Issued By",      "UrbanPuls"],
    ]
    _build(path, "UrbanPuls - Traffic Violation Fine", "#D85A30", "#FAECE7", "#712B13", "#F0997B", "#FFFAF8",
           rows, "This fine was generated after the complaint was verified by an UrbanPuls administrator.")
    return str(path)

def generate_report_pdf(title: str, subtitle: str, headers: list[str], rows: list[list]) -> bytes:
    """Landscape table; the last row is treated as the totals row."""
    import io
    from reportlab.lib.pagesizes import landscape
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=1.5*cm, bottomMargin=1.5*cm,
                            leftMargin=1.2*cm, rightMargin=1.2*cm, title=title)
    styles = getSampleStyleSheet()
    cell = ParagraphStyle("cell", parent=styles["Normal"], fontSize=8, leading=10)
    head = ParagraphStyle("head", parent=cell, fontName="Helvetica-Bold", textColor=colors.white)
    fmt = lambda v: f"{v:,.2f}" if isinstance(v, float) else str(v)
    data = [[Paragraph(h, head) for h in headers]] + [[Paragraph(fmt(v), cell) for v in r] for r in rows]
    table = Table(data, repeatRows=1, colWidths=[4.2*cm] + [(27.3 - 4.2) / (len(headers) - 1) * cm] * (len(headers) - 1))
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1D4ED8")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#F1F5F9")]),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E1F5EE")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    doc.build([
        Paragraph(title, styles["Heading1"]),
        Paragraph(f"{subtitle} · generated {fmt_local(utcnow())}", styles["Normal"]),
        Spacer(1, 0.5*cm),
        table,
    ])
    return buf.getvalue()

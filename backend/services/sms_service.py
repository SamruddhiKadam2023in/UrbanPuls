import logging
from core.config import settings

log = logging.getLogger("tpms.sms")

def notify_police(complaint) -> bool:
    """Sends an SMS alert when Twilio is configured. Returns False when skipped or failed."""
    if not settings.twilio_enabled:
        return False
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        message = (
            f"TPMS ALERT\n"
            f"Complaint: {complaint.complaint_type.value.replace('_', ' ').title()}\n"
            f"Location: https://maps.google.com/?q={complaint.latitude},{complaint.longitude}\n"
            f"Fine ID: FINE-{complaint.id:06d}"
        )
        client.messages.create(body=message, from_=settings.TWILIO_PHONE_NUMBER, to=settings.POLICE_PHONE_NUMBER)
        return True
    except Exception:
        log.exception("SMS to police failed")
        return False

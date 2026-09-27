from twilio.rest import Client
from core.config import settings

def notify_police(complaint) -> bool:
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        message = (
            f"🚨 TPMS ALERT\n"
            f"Complaint: {complaint.complaint_type.value.replace('_', ' ').title()}\n"
            f"Location: {complaint.latitude}, {complaint.longitude}\n"
            f"Maps: https://maps.google.com/?q={complaint.latitude},{complaint.longitude}\n"
            f"Fine ID: FINE-{complaint.id:06d}\n"
            f"Action required."
        )
        client.messages.create(
            body=message,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=settings.POLICE_PHONE_NUMBER
        )
        return True
    except Exception as e:
        print(f"SMS failed: {e}")
        return False

"""
Notification and email texts in English, Hindi and Marathi.

Each entry is (title, body) with str.format placeholders. The user's preferred_lang picks the
language; anything missing falls back to English. Keep placeholders identical across languages
(tests/test_phase3.py checks this).
"""

MESSAGES: dict[str, dict[str, tuple[str, str]]] = {
    "booking_reserved": {
        "en": ("Parking reserved",
               "Slot {slot} at {zone} from {start}. Show code {code} at the gate and arrive within {grace} minutes of the start time."),
        "hi": ("पार्किंग आरक्षित",
               "{zone} में स्लॉट {slot}, {start} से। गेट पर कोड {code} दिखाएँ और शुरुआत के {grace} मिनट के भीतर पहुँचें।"),
        "mr": ("पार्किंग राखीव",
               "{zone} येथे जागा {slot}, {start} पासून. गेटवर कोड {code} दाखवा आणि सुरुवातीपासून {grace} मिनिटांत पोहोचा."),
    },
    "checked_in": {
        "en": ("Checked in", "{vehicle} is parked in slot {slot} at {zone}. You pay at the gate when you leave."),
        "hi": ("चेक इन हुआ", "{vehicle} {zone} में स्लॉट {slot} में पार्क है। निकलते समय गेट पर भुगतान करें।"),
        "mr": ("चेक इन झाले", "{vehicle} {zone} येथे जागा {slot} मध्ये पार्क आहे. निघताना गेटवर पैसे द्या."),
    },
    "checked_out": {
        "en": ("Thanks for parking with us", "{vehicle} left {zone}. Rs {amount} paid{method}.{points} Your receipt is in My Bookings."),
        "hi": ("पार्किंग के लिए धन्यवाद", "{vehicle} {zone} से निकल गया। Rs {amount} का भुगतान हुआ{method}।{points} आपकी रसीद मेरी बुकिंग में है।"),
        "mr": ("पार्किंगबद्दल धन्यवाद", "{vehicle} {zone} मधून बाहेर पडले. Rs {amount} दिले{method}.{points} तुमची पावती माझ्या बुकिंगमध्ये आहे."),
    },
    "checked_out_method": {
        "en": ("", " by {method}"),
        "hi": ("", " ({method} से)"),
        "mr": ("", " ({method} ने)"),
    },
    "checked_out_points": {
        "en": ("", " {n} points used."),
        "hi": ("", " {n} अंक इस्तेमाल हुए।"),
        "mr": ("", " {n} गुण वापरले."),
    },
    "reminder": {
        "en": ("Your parking starts soon", "Slot {slot} at {zone} is held for you from {start}. Show code {code} at the gate."),
        "hi": ("आपकी पार्किंग जल्द शुरू होगी", "{zone} में स्लॉट {slot} {start} से आपके लिए रखा है। गेट पर कोड {code} दिखाएँ।"),
        "mr": ("तुमची पार्किंग लवकरच सुरू होईल", "{zone} येथे जागा {slot} {start} पासून तुमच्यासाठी राखीव आहे. गेटवर कोड {code} दाखवा."),
    },
    "no_show": {
        "en": ("Reservation released",
               "Your car didn't arrive at {zone} by {deadline}, so slot {slot} was released. Please cancel bookings you can't make: "
               "after {limit} missed bookings in {days} days, online booking is paused."),
        "hi": ("आरक्षण छोड़ दिया गया",
               "आपकी कार {deadline} तक {zone} नहीं पहुँची, इसलिए स्लॉट {slot} छोड़ दिया गया। जिन बुकिंग पर न आ सकें उन्हें रद्द करें: "
               "{days} दिनों में {limit} बार न पहुँचने पर ऑनलाइन बुकिंग रोक दी जाती है।"),
        "mr": ("आरक्षण सोडले",
               "तुमची गाडी {deadline} पर्यंत {zone} येथे पोहोचली नाही, म्हणून जागा {slot} सोडली. जिथे येऊ शकत नाही त्या बुकिंग रद्द करा: "
               "{days} दिवसांत {limit} वेळा न आल्यास ऑनलाइन बुकिंग थांबवले जाते."),
    },
    "complaint_new": {
        "en": ("New complaint to review", "{type} reported by {name}."),
        "hi": ("समीक्षा के लिए नई शिकायत", "{name} ने {type} की शिकायत की।"),
        "mr": ("पुनरावलोकनासाठी नवीन तक्रार", "{name} यांनी {type} ची तक्रार केली."),
    },
    "complaint_verified": {
        "en": ("Complaint verified", "Your {type} report was verified. You earned {points} reward points."),
        "hi": ("शिकायत सत्यापित", "आपकी {type} की शिकायत सत्यापित हुई। आपको {points} रिवॉर्ड अंक मिले।"),
        "mr": ("तक्रार सत्यापित", "तुमची {type} ची तक्रार सत्यापित झाली. तुम्हाला {points} बक्षीस गुण मिळाले."),
    },
    "complaint_police": {
        "en": ("Verified complaint needs action", "{type} at {lat}, {lng}."),
        "hi": ("सत्यापित शिकायत पर कार्रवाई ज़रूरी", "{lat}, {lng} पर {type}।"),
        "mr": ("सत्यापित तक्रारीवर कारवाई आवश्यक", "{lat}, {lng} येथे {type}."),
    },
    "complaint_rejected": {
        "en": ("Complaint not accepted", "Your {type} report could not be verified.{note}"),
        "hi": ("शिकायत स्वीकार नहीं हुई", "आपकी {type} की शिकायत सत्यापित नहीं हो सकी।{note}"),
        "mr": ("तक्रार स्वीकारली नाही", "तुमची {type} ची तक्रार सत्यापित होऊ शकली नाही.{note}"),
    },
    "complaint_resolved": {
        "en": ("Complaint resolved", "Action has been taken on your {type} report.{note}"),
        "hi": ("शिकायत हल हुई", "आपकी {type} की शिकायत पर कार्रवाई हो गई है।{note}"),
        "mr": ("तक्रार निकाली", "तुमच्या {type} च्या तक्रारीवर कारवाई झाली आहे.{note}"),
    },
    "note_suffix": {
        "en": ("", " Note: {note}"),
        "hi": ("", " टिप्पणी: {note}"),
        "mr": ("", " टीप: {note}"),
    },
    "vendor_approved": {
        "en": ("Vendor account approved", "You can now add your parking zones and use the Gate screen."),
        "hi": ("विक्रेता खाता मंज़ूर", "अब आप अपने पार्किंग क्षेत्र जोड़ सकते हैं और गेट स्क्रीन इस्तेमाल कर सकते हैं।"),
        "mr": ("विक्रेता खाते मंजूर", "आता तुम्ही तुमची पार्किंग क्षेत्रे जोडू शकता आणि गेट स्क्रीन वापरू शकता."),
    },
    "vendor_declined": {
        "en": ("Vendor request declined", "Your request for a vendor account was not approved. Contact support if you think this is a mistake."),
        "hi": ("विक्रेता अनुरोध अस्वीकार", "आपका विक्रेता खाते का अनुरोध मंज़ूर नहीं हुआ। अगर यह गलती लगे तो सहायता से संपर्क करें।"),
        "mr": ("विक्रेता विनंती नाकारली", "तुमची विक्रेता खात्याची विनंती मंजूर झाली नाही. ही चूक वाटल्यास मदत विभागाशी संपर्क करा."),
    },
}

COMPLAINT_TYPES = {
    "illegal_parking":    {"en": "illegal parking",    "hi": "अवैध पार्किंग",  "mr": "बेकायदेशीर पार्किंग"},
    "road_blockage":      {"en": "road blockage",      "hi": "सड़क अवरोध",    "mr": "रस्ता अडथळा"},
    "signal_malfunction": {"en": "signal malfunction", "hi": "सिग्नल खराबी",  "mr": "सिग्नल बिघाड"},
    "accident":           {"en": "accident",           "hi": "दुर्घटना",       "mr": "अपघात"},
    "vendor_issue":       {"en": "vendor issue",       "hi": "विक्रेता समस्या", "mr": "विक्रेता समस्या"},
}

EMAIL_GREETING = {"en": "Hi {name},", "hi": "नमस्ते {name},", "mr": "नमस्कार {name},"}

def lang_of(user) -> str:
    lang = getattr(user, "preferred_lang", None) or "en"
    return lang if lang in ("en", "hi", "mr") else "en"

def render(key: str, lang: str, **params) -> tuple[str, str]:
    entry = MESSAGES[key]
    title, body = entry.get(lang) or entry["en"]
    return title.format(**params), body.format(**params)

def complaint_type(value: str, lang: str) -> str:
    names = COMPLAINT_TYPES.get(value, {})
    return names.get(lang) or names.get("en") or value.replace("_", " ")

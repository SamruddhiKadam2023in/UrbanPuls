export function speak(text, lang = 'en-US') {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = lang === 'hi' ? 'hi-IN' : 'en-US'
  utter.rate = 1
  utter.pitch = 1
  window.speechSynthesis.speak(utter)
}

export function speakBookingConfirm(zone, amount, lang = 'en') {
  const msg = lang === 'hi'
    ? `बुकिंग सफल। ${zone} में पार्किंग। कुल राशि ${amount} रुपये।`
    : `Booking confirmed at ${zone}. Total amount: ${amount} rupees.`
  speak(msg, lang)
}

export function speakViolationAlert(lang = 'en') {
  const msg = lang === 'hi'
    ? 'सावधान। अवैध पार्किंग का उल्लंघन पाया गया।'
    : 'Alert. Illegal parking violation detected.'
  speak(msg, lang)
}

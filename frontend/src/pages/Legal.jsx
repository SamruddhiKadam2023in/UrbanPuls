import { useTranslation } from 'react-i18next'
import { SITE } from '../config'
import { PublicFooter, PublicHeader } from './Landing'

// DRAFT legal text describing how this software actually handles data.
// Have it reviewed by a lawyer and fill in the operator details (src/config.js) before launch.
const UPDATED = '29 September 2026'

const privacy = (s) => [
  ['Who we are', [
    `${s.operator} runs this parking service ("TPMS"). For any privacy question or request, write to ${s.contactEmail}. This address also reaches our Grievance Officer under the Digital Personal Data Protection Act, 2023.`,
  ]],
  ['What we collect', [
    'Account details: your name, email address, phone number (optional) and password (stored only as a secure hash).',
    'Parking details: vehicle numbers and types, the lots, slots and times you book, check-in and check-out times, amounts paid and how (cash or UPI), and ratings you give.',
    'Complaints you submit: the type, description, location and any photo or video you upload.',
    'Your device location, only at the moment you tap "Near me" or "Detect" in the app. It is not stored unless you submit a complaint with it.',
    'Technical data needed to run the service, such as your IP address in server logs and a login token, language and theme saved in your browser.',
  ]],
  ['Why we use it', [
    'To run your bookings: reserving slots, letting the Parking Partner check you in and out, working out the fee and issuing receipts.',
    'To send you messages about your bookings and complaints (in the app and by email).',
    'To handle complaints: reviewing them, awarding reward points and passing verified cases to Field Officers.',
    'To keep the service safe, for example limiting sign-in attempts and pausing booking after repeated no-shows.',
  ]],
  ['Who can see it', [
    'The Parking Partner who runs the lot you book (and their gate staff) sees your name, vehicle number, booking times and payments for that lot only.',
    'Administrators and Field Officers see complaints, including the reporter\'s name and email, so they can act on them.',
    'Service providers who host or support the app on our behalf, such as our hosting company, our email provider and our map provider (which receives your IP address when map tiles load).',
    'Authorities, when the law requires it.',
    'We do not sell your personal data.',
  ]],
  ['How long we keep it', [
    'While your account is open. When you delete your account we remove your name, email address and phone number straight away. Records of past parking visits and payments are kept without those details, because Parking Partners need them for their accounts and tax records.',
  ]],
  ['Your rights', [
    'See and download your data: Profile → Your data → Download my data.',
    'Correct it: edit your name, phone and email on your Profile.',
    'Erase it: Profile → Your data → Delete account.',
    'Withdraw consent or raise a grievance: write to the address above. We reply within 30 days. If you are not satisfied, you may complain to the Data Protection Board of India.',
  ]],
  ['Children', [
    'TPMS is meant for adults. If you are under 18, you may use it only with the consent of a parent or guardian.',
  ]],
  ['Security', [
    'Passwords are hashed, connections are encrypted (HTTPS), access is limited by role, and changing your password signs you out on every other device.',
  ]],
  ['Changes', [
    'If we change this policy we will update the date below and, for important changes, tell you in the app.',
  ]],
]

const terms = (s) => [
  ['The service', [
    `TPMS lets drivers find and reserve parking at lots run by independent Parking Partners, and lets anyone report parking and traffic problems. The service is run by ${s.operator}.`,
  ]],
  ['Reservations and payment', [
    'A reservation holds a slot for the time you choose. Nothing is charged when you reserve.',
    'You pay the Parking Partner at the gate, in cash or UPI, for the time you actually park (minimum one hour, then in 30-minute steps), at the rate shown when you booked.',
    'If you do not arrive within 15 minutes of your start time, the reservation ends and the slot is released. After 3 missed reservations in 30 days, online booking is paused for your account.',
    'Please cancel reservations you cannot use.',
  ]],
  ['Parking Partners', [
    'Parking Partners run their own lots and set their own prices. They are responsible for the lot, its staff, and collecting and recording payments correctly. TPMS is not a party to the payment between you and the Parking Partner.',
  ]],
  ['Complaints and reward points', [
    'Reports must be true and made in good faith. Photos should show the problem, not identify bystanders. False or abusive reports may be rejected and can lead to your account being closed.',
    'Reward points have no cash value and can only be used as a discount on parking through TPMS.',
  ]],
  ['Your account', [
    'Keep your password secret. You are responsible for bookings made from your account. We may suspend accounts that break these terms or misuse the service.',
  ]],
  ['Liability', [
    'We work to keep availability information accurate, but a slot shown as free may occasionally be unavailable. Your vehicle and belongings remain your responsibility while parked. To the extent the law allows, our liability is limited to the amount you paid for the booking concerned.',
  ]],
  ['Contact', [
    `Questions about these terms: ${s.contactEmail}.`,
  ]],
]

function LegalPage({ title, sections }) {
  const { t, i18n } = useTranslation()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader />
      <main style={{ flex: 1, maxWidth: '760px', margin: '0 auto', padding: '40px 20px', width: '100%' }}>
        <h1 className="section-header" style={{ fontSize: '30px', marginBottom: '6px' }}>{title}</h1>
        <p style={{ fontSize: '13px', color: 'var(--c-text3)', marginBottom: '24px' }}>{t('legal.updated', 'Last updated')}: {UPDATED}</p>
        {i18n.language !== 'en' && (
          <p className="card" style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--c-text2)', marginBottom: '24px' }}>
            {t('legal.english_only', 'This page is currently available in English only.')}
          </p>
        )}
        {sections.map(([heading, paras]) => (
          <section key={heading} style={{ marginBottom: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--c-text)', marginBottom: '8px' }}>{heading}</h2>
            {paras.length === 1
              ? <p style={{ fontSize: '14px', color: 'var(--c-text2)', lineHeight: 1.7 }}>{paras[0]}</p>
              : <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {paras.map(p => <li key={p} style={{ fontSize: '14px', color: 'var(--c-text2)', lineHeight: 1.7 }}>{p}</li>)}
                </ul>}
          </section>
        ))}
      </main>
      <PublicFooter />
    </div>
  )
}

export function Privacy() {
  const { t } = useTranslation()
  return <LegalPage title={t('landing.privacy', 'Privacy policy')} sections={privacy(SITE)} />
}

export function Terms() {
  const { t } = useTranslation()
  return <LegalPage title={t('landing.terms', 'Terms of use')} sections={terms(SITE)} />
}

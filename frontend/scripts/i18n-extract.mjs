// Keeps the translation files in step with the code.
//
//   npm run i18n:check   reports keys missing from en/hi/mr, exits 1 if any are missing
//   npm run i18n:sync    rewrites en.json from the code: adds new keys, updates English text that
//                        changed in the code, and removes keys nothing uses any more
//
// The code is the source of truth for English: t('booking.title', 'Reserve parking').
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'src')
const LOCALES = path.join(SRC, 'locales')
const LANGS = ['en', 'hi', 'mr']

// Keys built at runtime, e.g. t(`status.${b.status}`), cannot be found by scanning; list them here
const DYNAMIC = {
  status: ['reserved', 'checked_in', 'completed', 'cancelled', 'no_show'],
  complaint_status: ['pending', 'verified', 'rejected', 'resolved'],
  'complaints.types': ['illegal_parking', 'road_blockage', 'signal_malfunction', 'accident', 'vendor_issue'],
  roles: ['user', 'vendor', 'police', 'admin'],
  nav: ['map', 'bookings', 'gate', 'zones', 'complaints', 'police', 'yolo', 'analytics', 'dashboard', 'admin', 'emergency'],
  emergency: ['police', 'police_sub', 'ambulance', 'ambulance_sub', 'fire', 'fire_sub'],
}

const files = []
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
  const p = path.join(dir, e.name)
  if (e.isDirectory() && e.name !== 'locales') walk(p)
  else if (/\.(jsx?|mjs)$/.test(e.name)) files.push(p)
})
walk(SRC)

const found = new Map()   // key -> English default from the code, or null when none is given
const RE = /\bt\(\s*(['"])([a-z_]+(?:\.[a-z0-9_]+)+)\1\s*(?:,\s*(['"`])((?:\\.|(?!\3).)*)\3)?/g
for (const f of files) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(RE)) {
    const [, , key, , def] = m
    const value = def !== undefined ? def.replace(/\\(['"`\\])/g, '$1') : null
    if (!found.has(key) || (found.get(key) === null && value !== null)) found.set(key, value)
  }
}
for (const [prefix, values] of Object.entries(DYNAMIC)) {
  values.forEach(v => { if (!found.has(`${prefix}.${v}`)) found.set(`${prefix}.${v}`, null) })
}

const get = (obj, key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
const set = (obj, key, value) => {
  const parts = key.split('.')
  let o = obj
  parts.slice(0, -1).forEach(p => { if (typeof o[p] !== 'object') o[p] = {}; o = o[p] })
  o[parts.at(-1)] = value
}
const load = (lang) => {
  const file = path.join(LOCALES, `${lang}.json`)
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
}

if (process.argv.includes('--write')) {
  const en = load('en')
  const out = {}
  for (const k of [...found.keys()].sort()) {
    const code = found.get(k)
    const current = get(en, k)
    if (code !== null && typeof current === 'string' && current !== code) console.log(`en: updated ${k}`)
    if (code === null && typeof current !== 'string') console.log(`en: NEEDS TEXT ${k}`)
    set(out, k, code ?? current ?? k)
  }
  fs.mkdirSync(LOCALES, { recursive: true })
  fs.writeFileSync(path.join(LOCALES, 'en.json'), JSON.stringify(out, null, 2) + '\n')
  console.log(`en: ${found.size} keys written`)
}

const en = load('en')
let problems = 0
for (const lang of LANGS) {
  const data = load(lang)
  const missing = [...found.keys()].filter(k => typeof get(data, k) !== 'string').sort()
  // Placeholders like {{n}} must survive translation
  const badVars = lang === 'en' ? [] : [...found.keys()].filter(k => {
    const a = (get(en, k) || '').match(/{{\w+}}/g) || [], b = (get(data, k) || '').match(/{{\w+}}/g) || []
    return typeof get(data, k) === 'string' && a.sort().join() !== b.sort().join()
  })
  if (missing.length || badVars.length) {
    problems += missing.length + badVars.length
    console.log(`${lang}: ${missing.length} missing, ${badVars.length} with wrong {{placeholders}}`)
    missing.forEach(k => console.log(`  missing  ${k}  (en: ${JSON.stringify(get(en, k))})`))
    badVars.forEach(k => console.log(`  vars     ${k}  (en: ${JSON.stringify(get(en, k))})`))
  } else {
    console.log(`${lang}: complete (${found.size} keys)`)
  }
}
process.exit(problems ? 1 : 0)

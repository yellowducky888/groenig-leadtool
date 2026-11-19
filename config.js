/* =====================================================================
   TUINWAARDE CHECK: CONFIG (IN TE VULLEN MET BRONDATA)
   Alle percentages en bedragen hieronder zijn PLACEHOLDERS (demo-waarden
   zodat de check rekent). Ze hebben geen bron en zijn geen feit.
   Enkel de woningwaarde-middelpunten, de ranges (0,8/1,2 en 0,85/1,2)
   en de leadscore-punten komen uit de brief.
   ===================================================================== */
window.TW_CONFIG = {
  // Toon de oranje "Prototype"-melding op het resultaatscherm.
  // Zet op false zodra de echte waarden hierboven zijn ingevuld.
  showPlaceholderNotice: true,

  // Waar de leaddata naartoe gaat: de Vercel-functie api/lead.js, die via
  // Resend de bevestigingsmail en de leadmelding verstuurt.
  // Laat leeg om enkel een 'tuinwaarde:lead' event op window te sturen.
  crmEndpoint: '/api/lead',

  // Middelpunt per woningwaarde-schijf (uit de brief)
  homeValueMid: { lt300: 250000, '300to500': 400000, '500to750': 625000, '750to1000': 875000, gt1000: 1200000 },
  // Basismeerwaarde % volgens vraag 3. PLACEHOLDER [X1]..[X4]
  basePct: { bare: 0.10, dated: 0.08, loose: 0.05, done: 0.02 },
  // Bonus % per extra (vraag 4). PLACEHOLDER
  bonusPct: { terras: 0.01, pergola: 0.01, keuken: 0.01, zwem: 0.01, verlichting: 0.01, privacy: 0.01, tuinhuis: 0.01, onderhoud: 0.01 },
  // Maximum totale bonus. PLACEHOLDER [MAX]
  bonusMaxPct: 0.05,
  // Regiofactor (vraag 5). Standaard 1,0 volgens de brief
  regionFactor: { antwerpen: 1.0, oostvl: 1.0, westvl: 1.0, vlbrabant: 1.0, limburg: 1.0, brussel: 1.0, wallonie: 1.0 },
  // Oppervlakte in m² per tuinschijf voor de investering. PLACEHOLDER
  areaM2: { lt100: 75, '100to250': 175, '250to500': 375, '500to1000': 750, gt1000: 1200 },
  // Prijs per m² aanleg. PLACEHOLDER [prijs per m²]
  pricePerM2: 100,
  // Prijs per extra. PLACEHOLDER [prijs per extra]
  pricePerExtra: { terras: 10000, pergola: 10000, keuken: 10000, zwem: 10000, verlichting: 10000, privacy: 10000, tuinhuis: 10000, onderhoud: 10000 },
  // Ranges en afronding (uit de brief)
  valueRange: { low: 0.8, high: 1.2 },
  investRange: { low: 0.85, high: 1.2 },
  roundTo: 1000,
  // Leadscore-punten (uit de brief)
  lead: { valueHigh: 30, valueMid: 20, valueLow: 10, sell2: 30, sell5: 15, stay: 20, extras3: 20, phone: 20, hot: 70, warm: 40 }
};

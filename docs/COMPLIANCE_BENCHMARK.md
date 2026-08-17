# Compliance Benchmark — CONVERGENCE-Ai vs the Compliance-Automation Category

Benchmarked against the leading compliance-automation platform in the category.
The vendor is deliberately unnamed here; the catalogue below is the standard set
that category covers, and the framework names themselves are public standards.

## The comparison is not like-for-like, and that matters

Before any gap list is useful, the two things being compared have to be named
correctly, because they solve different problems and a naive gap list would send
engineering effort in the wrong direction.

| | Compliance-automation platform | CONVERGENCE-Ai |
|---|---|---|
| Subject | **The organisation** | **The tenant's individual actions** |
| Question answered | "Is this company certifiable against framework X?" | "Is this specific action lawful for this business right now?" |
| Mechanism | Continuous control monitoring, evidence collection, audit readiness | Pre-commit screening at the moment of action, with citations |
| Output | A certification or attestation | A verdict: pass / flag / block, plus evidence |
| Timing | Continuous, periodic audits | Synchronous, before the commit boundary |

The category answers *are we allowed to operate*. Convergence answers *is this
email, this refund, this record write allowed*. **Neither replaces the other**,
and Convergence should not attempt to become a compliance-automation platform —
elaborated in §6.

---

## 1. The benchmark catalogue (38 frameworks)

Grouped as the category covers them.

**Core security & attestation**
SOC 2 · ISO 27001 · NIST CSF 2.0 · CIS v8.1 · MVSP · AWS FTR · Cyber Essentials ·
Essential Eight (AU) · BSI C5 (DE)

**Privacy**
GDPR · US Data Privacy (19+ state laws) · ISO 27701 · ISO 27018

**Healthcare**
HIPAA · HITRUST CSF (e1, i1, r2)

**Payments & financial services**
PCI DSS · DORA (EU) · CPS 234 (APRA, AU) · 23 NYCRR 500 (NY DFS) ·
CRI Profile · SOX ITGC · OFDSS

**Government & defence**
FedRAMP · FedRAMP 20x · CMMC 2.0 · NIST 800-53 · NIST 800-171 · CJIS

**AI governance**
ISO 42001 · NIST AI RMF · EU AI Act

**Cloud, continuity, quality, sector**
ISO 27017 · ISO 22301 · ISO 9001 · TISAX (automotive) · NIS 2 (EU) ·
Microsoft SSPA · Custom frameworks

---

## 2. What CONVERGENCE-Ai actually has today

Two layers, and they disagree with each other — which is the first finding.

**Declared** (`lib/verticals.js`, attached at install, 6 of 14 verticals):

| Vertical | Declared profile |
|---|---|
| Medical | HIPAA, BAA |
| Legal | IOLTA, ABA-Model-1.15 |
| Real Estate | Fair-Housing-Act |
| Retail | PCI-DSS |
| Financial | GLBA-Safeguards, PCI-DSS |
| Education | FERPA |

**Implemented** (`lib/compliance.js` `REG_CORPUS`, 10 rules across 5 verticals):

| Vertical | Rules |
|---|---|
| Legal | ABA-Model-1.15, IOLTA |
| Medical | HIPAA-164.502 (minimum necessary), HIPAA-164.508 (authorisation) |
| Finance | GLBA-Safeguards, PCI-DSS |
| Retail | FTC-Act-5, PCI-DSS |
| Real Estate | Fair-Housing-Act |

### Finding 1 — Education is declared but unimplemented

`education` carries FERPA in its vertical profile, but `REG_CORPUS` has no
`education` key. `regulatorySearch({ vertical: 'education' })` returns **zero
rules**, and `validate()` produces **no citations**. A school-sector tenant
therefore installs with a compliance badge and no screening behind it.

This is the worst failure mode available: not an absent control, but a control
that appears present. **Fix first, before adding anything new.**

### Finding 2 — Eight verticals declare nothing at all

Hospitality · Construction · Logistics · SaaS/Tech · Professional Services ·
Non-Profit · Events · Event Rental.

`validate()` for these returns pass with no citations, so the compliance agent
contributes nothing on 57% of the vertical catalogue.

### Finding 3 — No AI-governance alignment whatsoever

Convergence is an AI system that assists and executes consequential decisions,
including HR-adjacent ones via the Human Companion. It aligns to **none** of
ISO 42001, NIST AI RMF or the EU AI Act, and does not screen against the emerging
US state AI-employment laws. Elaborated in §5 because it is the highest risk item
on this page.

---

## 3. Framework-by-framework gap

Split by which of the two questions each framework answers.

### 3a. Frameworks about AiWorXmiths as a vendor (buy, don't build)

Prospects will ask for these in security review. They are the benchmark
category's actual product.

| Framework | Status | Why it matters here |
|---|---|---|
| SOC 2 | ❌ none | The default enterprise ask; blocks mid-market deals without it |
| ISO 27001 | ❌ none | The international equivalent |
| HIPAA (as Business Associate) | ⚠️ partial | Product enforces PHI handling, but the *company* has no attested programme; a BAA counterparty will ask |
| ISO 42001 | ❌ none | AI management system — directly on-point for an AI governance vendor |
| NIST AI RMF | ❌ none | Increasingly requested in US enterprise and public-sector procurement |
| ISO 27701 / GDPR | ❌ none | Needed before EU tenants |
| PCI DSS | ➖ n/a | Convergence does not store cardholder data; tenants' processors do |
| FedRAMP / CMMC / CJIS | ➖ out of scope | Only if pursuing federal or defence customers |

### 3b. Frameworks Convergence should SCREEN tenant actions against (build)

This is the half the compliance-automation category does **not** do, and where
the product differentiates.

| Framework | Screening today | Gap |
|---|---|---|
| HIPAA | Partial — 2 rules | No HITECH breach notification, no 42 CFR Part 2, no state medical-privacy overlay |
| PCI DSS | Label only | No cardholder-data handling rules at the action level |
| GLBA | Label only | No Safeguards Rule specifics |
| FERPA | **Declared, absent** | See Finding 1 |
| US state privacy (19+) | ❌ none | Applies to nearly every vertical; the single widest gap |
| GDPR | ❌ none | Blocks EU tenants entirely |
| TCPA / state DNC | ❌ none | **Already exposed** — real-estate skip trace and every SMS/voice workflow |
| CAN-SPAM | ❌ none | Every email-sending workflow across all 14 verticals |
| ADA / WCAG | ❌ none | Any customer-facing output |
| EU AI Act, Colorado AI Act, NYC LL144 | ❌ none | See §5 |

---

## 4. Per-vertical gap register

What each vertical's regulations actually are, against what is implemented.

| # | Vertical | Implemented | Missing (priority order) |
|---|---|---|---|
| 1 | Medical | HIPAA ×2 | HITECH breach notification · 42 CFR Part 2 · state medical privacy · TCPA (reminders) · ADA |
| 2 | Legal | ABA 1.15, IOLTA | ABA 1.6 confidentiality · 1.1 cmt 8 tech competence · 1.7–1.9 conflicts · 5.5 unauthorised practice · 7.1–7.3 solicitation · state bar AI opinions |
| 3 | Real Estate | Fair Housing | **TCPA / DNC** · RESPA · TILA-TRID · ECOA · state licence law · MLS/IDX display rules |
| 4 | Retail | FTC §5, PCI | State privacy (CCPA + 18) · CAN-SPAM · TCPA · FTC click-to-cancel · CPSC product safety · sales-tax nexus |
| 5 | Hospitality | **none** | ADA Title III · PCI · state privacy · alcohol licensing · FDA Food Code · OSHA · TCPA |
| 6 | Financial | GLBA, PCI | SOX (public clients) · IRS Circular 230 · AICPA standards · BSA/AML · state accountancy · 1099/W-9 |
| 7 | Construction | **none** | OSHA 29 CFR 1926 · state contractor licensing · Davis-Bacon prevailing wage · mechanics lien law · EPA RRP lead-safe · I-9 |
| 8 | Logistics | **none** | FMCSA hours-of-service / ELD · 49 CFR hazmat · CBP customs · Carmack cargo liability · C-TPAT |
| 9 | Education | **declared, absent** | FERPA (implement) · COPPA · state student privacy (SOPIPA) · Title IX · ADA §508 · background checks |
| 10 | SaaS / Tech | **none** | State privacy (19+) · GDPR · CAN-SPAM · DMCA · WCAG/ADA · export controls · EU AI Act |
| 11 | Professional Services | **none** | State professional licensing · professional liability · confidentiality · state privacy · FTC §5 |
| 12 | Non-Profit | **none** | IRS 501(c)(3) · Form 990 · **state charitable solicitation registration (40 states)** · donor privacy · UBIT · lobbying limits |
| 13 | Events | **none** | ADA Title III · liability waivers · alcohol service · BOTS Act ticketing · venue permits · TCPA |
| 14 | Event Rental | **none** | CPSC product safety · amusement-device regulation · state rental/lease law · deposit rules · liability waivers · ADA |

**Cross-cutting, applies to all 14:** US state privacy · TCPA/DNC on any outbound
contact · CAN-SPAM on any email · ADA/WCAG on customer-facing output · employment
law through the HR surface (FLSA, state wage rules).

---

## 5. The AI-governance gap (highest risk)

Convergence is an AI system that acts. Three exposures, in order of immediacy:

**NYC Local Law 144** requires an annual independent bias audit of automated
employment decision tools, plus candidate notice. The Human Companion and the
upskilling module operate adjacent to employment decisions. If any tenant uses
them for screening, promotion or scheduling decisions, LL144 may attach — and
today nothing in the product classifies that or blocks it.

**Colorado AI Act (SB 24-205)** and **Illinois HB 3773** impose duties on
developers *and* deployers of AI making consequential decisions in employment,
lending, housing, education and healthcare — five of the fourteen verticals.

**EU AI Act** classifies by risk. AI used in employment, education access, credit
and essential services is high-risk, carrying conformity assessment, logging and
human-oversight obligations. Convergence's audit log and HITL model already
satisfy a good deal of the *substance*; what is missing is the classification, the
declaration and the evidence mapping.

The good news is that the hard part is built. Immutable audit log, human approval
on consequential actions, provenance, and the pre-commit gate are exactly the
controls these regimes ask for. **The gap is mapping and declaration, not
architecture.** That makes it unusually cheap to close relative to its risk.

---

## 6. Plan

### Phase 0 — Fix what is falsely declared (days)

1. Implement the education/FERPA corpus, or remove the declaration. Do not ship a
   badge with nothing behind it.
2. Add a test asserting **every** vertical's declared compliance profile has
   corresponding `REG_CORPUS` rules. This class of drift should fail the build,
   in the same way the version drift guard works.

### Phase 1 — Cross-cutting corpus (1–2 weeks)

Add a `universal` corpus applied to every vertical, since these attach regardless
of industry and are where the live exposure is:

- TCPA / state DNC — gate any outbound voice or SMS
- CAN-SPAM — gate any bulk email
- US state privacy — a data-subject-rights and disclosure baseline
- ADA / WCAG — customer-facing output

TCPA first: the real-estate skip trace and every Twilio workflow are live paths
today with no screening behind them.

### Phase 2 — Fill the eight empty verticals (4–6 weeks)

Two rules minimum per vertical, chosen for what agents will actually do rather
than for completeness. Sequence by exposure:

1. Construction (OSHA, licensing) — physical safety
2. Logistics (FMCSA, hazmat) — physical safety
3. Non-Profit (charitable solicitation) — 40-state registration is a real trap
4. Hospitality (ADA, alcohol) · 5. Education (finish) · 6. Events ·
   7. Event Rental · 8. Tech · 9. Professional Services

### Phase 3 — AI governance (4–6 weeks, start now)

1. Risk-classify each vertical workflow against EU AI Act categories.
2. Map existing controls — audit log, HITL approval, provenance, pre-commit — to
   NIST AI RMF functions. Mostly a documentation exercise against shipped code.
3. Add a consequential-decision screen: flag when an agent action touches
   employment, lending, housing, education access or healthcare, and require
   elevated approval.
4. Publish an AI transparency statement per tenant deployment.

### Phase 4 — Vendor posture (buy)

**Do not build this.** Purchase a compliance-automation platform for
AiWorXmiths' own SOC 2 Type II, then ISO 27001, then ISO 42001. Rebuilding
continuous control monitoring would consume the roadmap and produce a worse
version of a mature product, while the screening corpus — which nobody else
builds — went unwritten.

### What this positions against

After Phases 0–3, the honest claim is *"compliance-automation platforms certify
your company; we screen your agents' actions in real time against the regulations
of your industry."* That is a complementary story rather than a competitive one,
and it is defensible because it is true. Claiming to replace the category would
not be.

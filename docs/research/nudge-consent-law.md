# What do GDPR and ePrivacy require before we can send Nudges?

Research for issue #2 (part of map #1). Researched 2026-11-09. This is engineering research from primary sources, **not legal advice**. Have counsel confirm it before launch.

## Short answer

- **Treat Nudges as direct marketing.** EU law has no clean "service message" exemption for emails that try to bring someone back to a product. "We added a lesson" is close to a service message. "You haven't watched in N days" is engagement marketing. A cautious design treats both as marketing.
- **Individual Purchase Students: opt-out (soft opt-in) is lawful**, but only if all the conditions of ePrivacy art. 13(2) are met. The most important one is that the Student was offered a free, easy way to refuse **at the moment we collected their email at checkout**, and again in every Nudge.
- **Claimed Seat Students: get opt-in consent.** The soft opt-in covers contact details that a sender obtains "from its customers ... in the context of the sale". The Student on a Team Licence did not buy anything: the employer did. Whether a free Claimed Seat counts as a "sale" to the Student is untested. The CJEU's *Inteligo Media* ruling (C-654/23) makes the argument possible, but we should not rely on it.
- **Unsubscribe:** must be in every Nudge, free and easy (no login, no questionnaire), and sent with the sender's real identity and a valid address for opt-out requests. One-click (RFC 8058) is not required by EU law, but Gmail and Yahoo require it for bulk mail, and Postmark Broadcast streams add it automatically.
- **Records:** keep proof of consent (who, when, how, the wording shown) and a permanent suppression record of objections. The Dutch ACM expects proof of consent for up to 5 years after sending.
- **Country matters, and it is the Student's country, not the buyer's.** Each member state implements art. 13 in its own law (NL Telecommunicatiewet art. 11.7, DE UWG §7). Germany is the strictest, and there is no one-stop-shop for ePrivacy. We can't use the buyer's country from the Purchase (ADR 0009) for Claimed Seats.

## 1. The legal framework

### ePrivacy Directive 2002/58/EC, article 13 (as amended by 2009/136/EC)

- **Art. 13(1):** email "for the purposes of direct marketing may be allowed only in respect of subscribers or users who have given their prior consent."
- **Art. 13(2), the soft opt-in:** "where a natural or legal person obtains from its customers their electronic contact details for electronic mail, in the context of the sale of a product or a service ... the same natural or legal person may use these electronic contact details for direct marketing of its own similar products or services provided that customers clearly and distinctly are given the opportunity to object, free of charge and in an easy manner, to such use of electronic contact details at the time of their collection and on the occasion of each message in case the customer has not initially refused such use."
- **Art. 13(4):** direct marketing email must not "disguise or conceal the identity of the sender", and must have "a valid address to which the recipient may send a request that such communications cease".
- **Art. 13(5):** paragraphs 1 and 3 apply to "subscribers who are natural persons". Legal persons get protection set by national law.

Source: Directive 2002/58/EC, art. 13, consolidated text ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02002L0058-20091219); text read from the [legislation.gov.uk copy of the EU text](https://www.legislation.gov.uk/eudr/2002/58/article/13) because EUR-Lex blocked automated fetches).

The Directive does not define "direct marketing".

### GDPR (Regulation (EU) 2016/679)

- **Art. 95:** the GDPR "shall not impose additional obligations" in areas where ePrivacy sets "specific obligations with the same objective". For marketing email, ePrivacy art. 13 is the specific rule (*lex specialis*).
- **Art. 6(1):** sets the lawful bases. The relevant ones are (a) consent, (b) contract, and (f) legitimate interests.
- **Recital 47:** "The processing of personal data for direct marketing purposes may be regarded as carried out for a legitimate interest."
- **Art. 7(1):** "the controller shall be able to demonstrate that the data subject has consented".
- **Art. 7(3):** consent can be withdrawn "at any time", and "It shall be as easy to withdraw as to give consent."
- **Art. 21(2)–(3):** a person has an absolute right to object to direct marketing at any time. Once they object, "the personal data shall no longer be processed for such purposes."
- **Art. 21(4):** the right to object must be "explicitly brought to the attention of the data subject" at the latest at the first communication, "clearly and separately from any other information".

Source: GDPR arts. [6](https://www.legislation.gov.uk/eur/2016/679/article/6/adopted), [7](https://www.legislation.gov.uk/eur/2016/679/article/7/adopted), [21](https://www.legislation.gov.uk/eur/2016/679/article/21/adopted), [95](https://www.legislation.gov.uk/eur/2016/679/article/95/adopted) (as adopted, legislation.gov.uk copy of the EU text), and recital 47 ([EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

### How the two fit together: CJEU *Inteligo Media* (C-654/23, 13 November 2025)

I could not retrieve the judgment text: CURIA and EUR-Lex blocked automated fetches, and the Danish PDF uses subset fonts I couldn't extract. The holdings below come from the [CURIA case page](https://curia.europa.eu/juris/liste.jsf?num=C-654/23) metadata and from consistent practitioner summaries ([ICTRecht](https://www.ictrecht.nl/en/blog/inteligo-media-simplification-of-direct-marketing-rules-and-beyond), [Matheson](https://www.matheson.com/insights/cjeu-clarifies-direct-marketing-rules-under-eprivacy-directive/), [Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2025/11/european-court-of-justice-backs-the-advocate-general)). **Verify the paragraph numbers against the judgment before quoting them in a spec.**

- A newsletter sent to users of a free account on a news site (where the site also sold paid subscriptions) was direct marketing.
- Creating a free account can be a "sale of a product or a service" under art. 13(2). Indirect remuneration is enough.
- Where the art. 13(2) conditions are met, the processing does not also need a separate GDPR art. 6(1) basis (paras. 66–68, per ICTRecht).
- Commentators read the exception narrowly. Whether it covers a truly free service with no upsell is open (Matheson).

What this means for us: if a Nudge qualifies under the soft opt-in, we don't need a separate legitimate-interest assessment. If it doesn't qualify, we need art. 13(1) consent, which must meet the GDPR consent standard (arts. 4(11) and 7).

## 2. Are Nudges "direct marketing"?

**The law is unclear here.** The Directive has no definition. Regulators distinguish marketing from service messages by **purpose and tone**, not by whether something is being sold.

- **UK ICO, for comparison (PECR, the UK's version of the same Directive):** the ICO's direct marketing guidance says routine customer service messages are not marketing. Its guidance (and its consultation on the draft code) treats a message that "actively promotes or encourages the individual to make use of a particular service, special offer, or upgrade" as likely direct marketing. A service message with a promotional element counts as marketing as a whole. The ICO site returned 403 to automated fetches, so this wording is quoted as reported in the [UK Finance consultation response hosted by the ICO](https://cy.ico.org.uk/media2/migrated/4024338/uk-finance.pdf) and practitioner summaries. Check it against the [ICO guidance on direct marketing using electronic mail](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/) before relying on it.
- **Netherlands:** Telecommunicatiewet art. 11.7(1) covers "ongevraagde communicatie voor commerciële, ideële of charitatieve doeleinden" (unsolicited communication for commercial, idealistic or charitable purposes). That is broader than "selling something". ([wetten.overheid.nl, BWBR0009950, art. 11.7](https://wetten.overheid.nl/BWBR0009950/))
- **Germany:** UWG §7 regulates "Werbung" (advertising). German courts read this very broadly. My recollection is that the BGH has treated even customer-satisfaction survey emails as advertising (BGH VI ZR 225/17, 10 July 2018). I did not re-verify that case from source.

Applied to the two Nudge triggers:

| Nudge trigger | Assessment |
| --- | --- |
| "A new lesson was added to a course you're Enrolled on" | Closest to a service message: it gives information about something the Student already has. It becomes marketing if it promotes other courses or upsells. |
| "You haven't watched anything for N days" | Its purpose is to change behaviour and increase engagement. It is very likely marketing under the ICO approach, and certainly "Werbung" in Germany. |

**Recommendation:** design every Nudge type as direct marketing. Classifying them as service messages saves little, because the soft opt-in already covers most Individual Purchase Students. The classification would only really matter for Claimed Seat Students, and that is exactly where it is weakest.

## 3. Opt-out (soft opt-in) or opt-in?

All of the soft opt-in conditions (art. 13(2); NL art. 11.7(4); DE UWG §7(3); UK PECR reg. 22(3)) must hold:

1. **We obtained the email from the person ourselves**, in the context of a sale to them.
2. **The marketing is for our own similar products or services.** Nudges about the course the Student bought clearly qualify. Promoting other courses probably still qualifies as "similar". Promoting third-party products does not.
3. **They were given a clear, free, easy opportunity to object when we collected the address.** For example, an unticked "Don't send me course reminders" box, or a clear notice with a link at checkout.
4. **They can object again in every message.**
5. **They have not objected.**

### Individual Purchase Students: soft opt-in is lawful, with conditions

The Student is the buyer, so conditions 1–2 are met. Conditions 3–5 are product requirements:

- The checkout or sign-up flow must show the objection choice **at collection time**. ACM's summary of the Dutch rule: "Bestaande klanten mag u ongevraagd berichten sturen over producten of diensten die te maken hebben met eerdere aankopen ... Zij moeten zich wel kunnen afmelden." (You may send existing customers unsolicited messages about products or services related to earlier purchases. They must be able to unsubscribe.) ([ACM FAQ on sending email](https://www.acm.nl/nl/onderwerpen/telecommunicatie/internet/veelgestelde-vragen-over-het-versturen-van-e-mailberichten/))
- **Existing customers who bought before this notice existed were never offered an objection at collection.** On a strict reading, the soft opt-in doesn't cover them. Practitioner reports describe a recent ICO enforcement where a sender lost the soft opt-in because it offered no opt-out at collection.
- **Germany** adds a requirement: at collection *and* in every use, the customer must be told "dass er der Verwendung jederzeit widersprechen kann" (that they can object at any time). ([UWG §7(3)](https://www.gesetze-im-internet.de/uwg_2004/__7.html))

### Claimed Seat Students: opt-in consent

- Art. 13(2) requires the details to come "from its customers ... in the context of the sale". UK PECR reg. 22(3)(a) is more explicit: "in the course of the sale or negotiations for the sale of a product or service **to that recipient**". The Team Licence sale is to the employer, not the Student. ([PECR reg. 22](https://www.legislation.gov.uk/uksi/2003/2426/regulation/22))
- **Argument the other way (untested):** under *Inteligo Media*, a free account can be a "sale" where there is indirect remuneration. A Claimed Seat is an account the Student accepts, paid for indirectly by the employer. This is plausible, but no regulator or court has addressed seats paid for by a third party. Relying on it is a legal risk, and the cost of being wrong is enforcement for spam.
- **The employer can't consent for the Student.** Consent must come from the "subscriber or user" (art. 13(1)), and GDPR consent must be the data subject's own, freely given indication (GDPR art. 4(11)). An employment context also makes "freely given" harder to show for anything the employer arranges.
- **Business-address exceptions don't help.**
  - Art. 13(5) lets member states treat legal persons differently, but a work email belonging to a named person is still the email of a natural person, and the GDPR applies to it.
  - The Dutch business carve-out in art. 11.7(3)(a) only covers contact details the end user has published for receiving commercial messages. It does not cover a seat invite.
- **So:** ask the Student when they claim the Seat, with an unticked checkbox or a separate "Send me reminders" toggle. Store it as consent (see §5).

### Alternative: make reminders a feature the Student switches on

If the Student explicitly turns on a "remind me" setting, the Nudges become requested communications. These are not "unsolicited" under art. 13, and the GDPR basis is consent or contract. In practice this is the same as opt-in, and it may be easier to explain in the UI. Note the EDPB's position: GDPR art. 6(1)(b) (contract) generally does not cover marketing (EDPB Guidelines 2/2019 on art. 6(1)(b), not re-fetched for this note).

## 4. What must the unsubscribe offer?

Legal requirements:

- **In every message**, unless the person already refused. Required by art. 13(2) for the soft opt-in. NL art. 11.7(4)(b): "bij elke verzonden boodschap" (with every message sent). DE UWG §7(3)(4): "bei jeder Verwendung" (on every use).
- **Free of charge and easy.** ACM says it must be quick, "dus niet via bijvoorbeeld een ingewikkelde vragenlijst" (so not, for example, through a complicated questionnaire), and free, "dus niet via betaling met persoonsgegevens of een andere tegenprestatie" (so not paid for with personal data or anything else in return). ([ACM FAQ](https://www.acm.nl/nl/onderwerpen/telecommunicatie/internet/veelgestelde-vragen-over-het-versturen-van-e-mailberichten/))
  - Requiring a login to unsubscribe goes against "easy".
  - For consented Students, GDPR art. 7(3) also requires withdrawal to be as easy as giving consent. The EDPB says one-click consent must be "equally as easily" withdrawable. (EDPB [Guidelines 05/2020 on consent](https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines_202005_consent_en.pdf), paras. 113–114)
- **Sender identity and a valid opt-out address.** Required by art. 13(4). NL art. 11.7(7) requires "de werkelijke identiteit" (the real identity) of the sender and "een geldig postadres of nummer" (a valid postal address or number) for opt-out requests.
- **Right to object made explicit, at the latest in the first communication.** GDPR art. 21(4) requires this "clearly and separately from any other information". Put it in the privacy notice *and* in the first Nudge footer.
- **Honour it immediately and permanently for that purpose.** GDPR art. 21(3): "the personal data shall no longer be processed for such purposes". ACM: once someone unsubscribes, you may not send further unsolicited messages.

Not required by law, but required in practice:

- **One-click (RFC 8058).** Gmail and Yahoo have required `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` on marketing and bulk mail since June 2024. The `mailto:` method alone does not satisfy them. ([Postmark: List-Unsubscribe header](https://postmarkapp.com/support/article/1299-how-to-include-a-list-unsubscribe-header))
  - RFC 8058 requires one HTTPS URI, a POST with no cookies or auth context, no redirect, and a DKIM signature that covers both headers. ([RFC 8058](https://www.rfc-editor.org/rfc/rfc8058.html))
- **Postmark stream choice.** Postmark positions Transactional streams for "one-to-one emails triggered by a user action" and Broadcast streams for one-to-many sends such as product announcements and newsletters. ([Postmark: message streams](https://postmarkapp.com/support/article/1207-how-to-create-and-send-through-message-streams))
  - On Broadcast streams, Postmark by default adds the RFC 8058 headers and a visible unsubscribe link, and suppresses recipients who unsubscribe.
  - On Transactional streams, unsubscribe headers are "not required".
  - **Send Nudges on a Broadcast stream.**
- **Granularity.** Unsubscribing from Nudges must not stop transactional email (receipts, password resets, Seat invites). It should also not silently unsubscribe the Student from other marketing they consented to. A per-category preference is the cleanest approach.

## 5. What records must we keep?

- **Proof of consent (opt-in Students).**
  - GDPR art. 7(1) puts the burden of proof on the controller.
  - The EDPB says to keep enough to show "how consent was obtained, when consent was obtained and the information provided to the data subject at the time". In an online context, that means information on the session, documentation of the consent workflow at the time, and a copy of what was shown. "It would not be sufficient to merely refer to a correct configuration of the respective website." Collect no more than necessary. (EDPB Guidelines 05/2020, paras. 106–108)
  - The Dutch rule is phrased as a burden of proof: sending is forbidden "tenzij de verzender kan aantonen" (unless the sender can demonstrate) prior consent (art. 11.7(1)). ACM: "U kunt deze toestemming bewijzen tot 5 jaar na verzending." (You must be able to prove this consent for up to 5 years after sending.)
  - Store per Student: user id, email, timestamp, source (seat-claim screen, settings), version of the consent text shown, and later withdrawal events.
- **Proof of the soft opt-in conditions (Individual Purchase Students).**
  - NL art. 11.7(4) again requires a sender "die kan aantonen" (who can demonstrate) that the details came from a sale.
  - Store the Purchase link, the collection timestamp, the version of the objection notice shown at checkout, and the Student's choice at that time.
- **Objections and unsubscribes.**
  - Keep a suppression record (email or user id, timestamp, channel) even after other data is deleted. Without it you can't honour art. 21(3).
  - EDPB para. 107: after processing ends, keep proof only as long as needed for legal obligations or claims (GDPR art. 17(3)(b), (e)). A minimal suppression list fits that purpose.
- **Retention period.** No EU-wide period. The NL guide is 5 years after the last send (ACM). Choose a period per jurisdiction with counsel.

## 6. Does the Student's country matter?

**Yes, and the relevant country is the recipient's.**

- **ePrivacy is a directive.** Each state transposes it into its own law, and it has no GDPR-style one-stop-shop: GDPR art. 95 and the ePrivacy framework leave enforcement to national authorities.
  - NL: enforced by ACM for spam under Tw 11.7, and by AP for the GDPR.
  - DE: UWG §7 enforced through competitor and consumer-association claims, plus data protection authorities.
- **The Dutch regulator treats the rules as applying across the EEA by recipient.** ACM: "Het spamverbod geldt in alle EER-landen" (the spam ban applies in all EEA countries). Outside the EEA, "gelden de regels van die landen" (that country's rules apply); its example is a newsletter to customers in Japan, which must follow Japanese rules. (ACM FAQ)
- **Known differences between member states:**
  - **Germany:** opt-in requires "vorherige ausdrückliche Einwilligung" (prior express consent). The soft opt-in exists (§7(3)) but requires the "right to object at any time" notice at collection and in every use. Courts read "Werbung" broadly.
  - **Netherlands:** soft opt-in per art. 11.7(4). Consent must be provable by the sender. Business addresses get no blanket exception: art. 11.7(3) only covers addresses published for this purpose and recipients outside the EEA.
  - **UK (non-EU, for comparison):** PECR reg. 22(3) is explicit that the sale must be "to that recipient". It also adds a charity soft opt-in (reg. 22(3A)) that doesn't apply to us.
  - I did not verify other member states (FR, BE, ES, IT …) from source. Their transpositions differ in detail.
- **Our data problem:** per ADR 0009 we record the **buyer's** country on the Purchase.
  - For an Individual Purchase, buyer and Student are the same person, so that's a reasonable proxy.
  - For a Claimed Seat, the buyer's country is the employer's billing country, which says nothing about where the Student is.
  - If behaviour must vary by country, we need the Student's own country. The simpler option: **apply one EU-wide standard strict enough for Germany everywhere**. That means opt-in for Claimed Seats; soft opt-in for Individual Purchases with an explicit "you can object at any time" notice at checkout and in every Nudge.

## 7. Recommendation for the spec

1. **Classify all Nudge types as direct marketing** and send them on a Postmark **Broadcast** stream.
2. **Individual Purchase Students: soft opt-in.**
   - Show a clear objection option at checkout (unticked "don't send me course reminders", or an explicit notice with an opt-out link), worded to include "you can object at any time".
   - Record what was shown and what was chosen.
   - Don't Nudge existing customers who never saw that notice until they have been given the choice. Or treat them like Claimed Seats: ask first.
3. **Claimed Seat Students: opt-in.** Ask on the seat-claim or onboarding screen with an unticked box or toggle, and store a consent record. No Nudges until they say yes.
4. **Every Nudge** includes:
   - a visible unsubscribe link that works without login;
   - RFC 8058 one-click headers;
   - the sender's legal identity and contact address;
   - a statement of the right to object (GDPR art. 21(4)), at least in the first Nudge.
5. **Store** a consent or soft-opt-in record and a permanent suppression record per Student. Retain proof for at least 5 years after the last send.
6. **Keep Nudge content about the Student's own Enrollment** (and at most Cadence's own similar courses). No third-party promotion.
7. **One policy for the whole EEA**, so we don't depend on the Student's country, which we don't record.

## Open questions this raises for the spec

- **Backfill:** what do we do with Individual Purchase Students who bought before the checkout objection notice existed? Ask them once in-app, or treat them as opt-in?
- **Student country:** do we need to capture it for Claimed Seats (for non-EEA rules, or a future per-country policy), or is one EEA-wide policy enough?
- **"Similar products":** may a Nudge mention other Cadence courses, or only the Enrolled course? The legal room exists, but it widens the marketing footprint.
- **Employer visibility:** may the Team Licence buyer see or configure Nudges for their seats? Doing so could undermine "freely given" consent, and it adds a processor/controller question.
- **Unsubscribe scope:** a per-category preference (Nudges vs. other marketing) or a single switch? Where does the preference live (our database vs. Postmark suppressions), and which is the source of truth?
- **Is "new lesson added" a service message?** If the spec wants to send it to Claimed Seat Students without opt-in, that needs a legal sign-off. This research doesn't support it.
- **Counsel review** of *Inteligo Media* (C-654/23): does it make free Claimed Seats paid for by a third party a "sale"? A yes would allow soft opt-in for Claimed Seats.

## Sources

- Directive 2002/58/EC art. 13 (consolidated): [EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02002L0058-20091219) · [legislation.gov.uk copy](https://www.legislation.gov.uk/eudr/2002/58/article/13)
- GDPR arts. 6, 7, 21, 95; recital 47: [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) · [legislation.gov.uk (as adopted)](https://www.legislation.gov.uk/eur/2016/679/contents/adopted)
- CJEU C-654/23 *Inteligo Media*, 13 Nov 2025: [CURIA case page](https://curia.europa.eu/juris/liste.jsf?num=C-654/23) (judgment text not retrieved; see caveat in §1)
- EDPB Guidelines 05/2020 on consent, v1.1: [PDF](https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines_202005_consent_en.pdf)
- NL Telecommunicatiewet art. 11.7: [wetten.overheid.nl BWBR0009950](https://wetten.overheid.nl/BWBR0009950/)
- ACM, Veelgestelde vragen over het versturen van e-mailberichten: [acm.nl](https://www.acm.nl/nl/onderwerpen/telecommunicatie/internet/veelgestelde-vragen-over-het-versturen-van-e-mailberichten/)
- DE UWG §7: [gesetze-im-internet.de](https://www.gesetze-im-internet.de/uwg_2004/__7.html)
- UK PECR reg. 22: [legislation.gov.uk](https://www.legislation.gov.uk/uksi/2003/2426/regulation/22) · ICO guidance on direct marketing using electronic mail: [ico.org.uk](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/) (blocked automated fetch; positions quoted as reported)
- RFC 8058: [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc8058.html)
- Postmark: [List-Unsubscribe headers](https://postmarkapp.com/support/article/1299-how-to-include-a-list-unsubscribe-header) · [Message streams](https://postmarkapp.com/support/article/1207-how-to-create-and-send-through-message-streams)

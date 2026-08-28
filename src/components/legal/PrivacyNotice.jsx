import { X } from 'lucide-react'

export const PRIVACY_VERSION = '2026-08-27'

export function PrivacyNotice({ onAccept, onClose }) {
  return (
    <div className="overlay privacyOverlay" role="presentation">
      <section className="privacyDialog" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
        <button type="button" className="privacyClose" onClick={onClose} aria-label="Close privacy notice"><X size={18} /></button>
        <small>VERSION {PRIVACY_VERSION}</small>
        <h2 id="privacy-title">Privacy & data-sharing notice</h2>
        <p className="privacyLead">This notice explains how personal data is used when a client activates Olivia One and connects mail or calendar accounts.</p>

        <h3>Data controller</h3>
        <p><b>O7 Digital Consulting</b> — SIREN 899 748 560 — SIRET 899 748 560 00013 — VAT FR17 899748560<br />10 rue de Penthièvre, 75008 Paris, France<br />Privacy contact: <a href="mailto:info@o7digitalgroup.com">info@o7digitalgroup.com</a></p>

        <h3>Data and purposes</h3>
        <p>O7 processes account identity, authentication and security logs, connected mailbox and calendar content, contacts, attachments, classifications, tasks, and AI-generated analyses. Processing is limited to providing the contracted workspace, synchronizing connected services, securing the platform, assisting users, and generating requested Olivia analyses.</p>

        <h3>Sharing and artificial intelligence</h3>
        <p>The client authorizes necessary processing and sharing between its authorized workspace users, O7 Digital Consulting, connected email/calendar providers, hosting and security suppliers, and AI subprocessors used to deliver Olivia. O7 does not sell personal data. Client administrators remain responsible for ensuring they may lawfully connect and process third-party correspondence.</p>

        <h3>Legal bases, retention and transfers</h3>
        <p>Depending on the processing, O7 relies on performance of the service contract, legal obligations, legitimate interests in security and service improvement, and consent where required. Data is kept only for the account lifecycle and applicable legal or operational retention periods, then deleted or anonymized. International transfers may occur where a provider operates outside the user’s country; O7 will use applicable contractual and organizational safeguards.</p>

        <h3>Your privacy rights</h3>
        <p>Subject to applicable law, individuals may request access, correction, deletion, restriction, portability, opposition, withdrawal of consent, or information about disclosure. Mexican users may exercise ARCO rights (access, rectification, cancellation and opposition). California residents may exercise rights to know, delete, correct, opt out of sale/sharing, limit certain sensitive-data uses, and non-discrimination where the CCPA applies. Canadian users receive the protections applicable under PIPEDA and relevant provincial laws.</p>

        <h3>Applicable frameworks</h3>
        <p>This notice is intended to support transparency under the EU/UK GDPR and French data-protection rules, Mexico’s Federal Law on Protection of Personal Data Held by Private Parties, the California CCPA as amended, and Canada’s PIPEDA, in each case where applicable. Local mandatory rules may provide additional rights.</p>
        <p className="privacySources">Official references: <a href="https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3" target="_blank" rel="noreferrer">EU GDPR guidance</a> · <a href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf" target="_blank" rel="noreferrer">Mexico LFPDPPP</a> · <a href="https://oag.ca.gov/privacy/ccpa" target="_blank" rel="noreferrer">California CCPA</a> · <a href="https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/" target="_blank" rel="noreferrer">Canada PIPEDA</a>.</p>

        <p className="privacyLegalNote">This operational notice must be reviewed by qualified privacy counsel before broad commercial rollout, especially for international transfers, retention schedules, subprocessors, minors, and sensitive data.</p>
        <div className="privacyActions">
          <button type="button" className="privacyCancel" onClick={onClose}>Close</button>
          <button type="button" className="privacyDone" onClick={onAccept}>Accept and continue</button>
        </div>
      </section>
    </div>
  )
}

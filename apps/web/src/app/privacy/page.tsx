import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy | Tanergy',
  description: 'Tanergy privacy policy for account, canvas, asset, collaboration, AI and beta billing data.',
}

const sections = [
  {
    title: '1. Who this policy is for',
    body: [
      'This Privacy Policy explains how Tanergy handles personal data when people visit the website, create an account, use the AI image canvas, upload assets, invite collaborators, use Team or Group workspaces, contact support, or interact with billing and usage surfaces.',
      'Tanergy is currently in private beta. The final operating company name, registered address, privacy contact and data protection contact must be inserted before public paid launch. Until then, privacy requests should be sent through the support channel published in the product or on the website.',
      'This policy does not replace separate contracts that may later apply to enterprise customers, data processing agreements, payment provider terms, AI provider terms, or other third-party services.',
    ],
  },
  {
    title: '2. Information you provide',
    body: [
      'Account data may include your name, display name, email address, authentication identifiers, profile settings, avatar, preferred language, workspace membership, invitation state and account status.',
      'Workspace and canvas data may include board names, pages, nodes, prompts, text cards, comments, canvas markup, image references, merge-capture inputs, runtime edges, saved snapshots, share links, member roles and audit metadata.',
      'Asset data may include images you upload, images generated through AI features, derived thumbnails, file metadata, storage references and related prompt or canvas context needed to provide the service.',
      'Support and feedback data may include messages, screenshots, logs you choose to send, bug reports, feature requests and other information you provide when communicating with Tanergy.',
      'Billing data may include plan selection, credit grants, usage ledgers, top-ups, invoices, refunds, payment status, workspace seat facts and tax-related records. Tanergy does not intend to store full payment card numbers; payment card processing should be handled by the active payment provider.',
    ],
  },
  {
    title: '3. Information collected automatically',
    body: [
      'Tanergy may collect technical data such as IP address, device type, browser, operating system, language, time zone, request path, referring page, session identifiers, cookie identifiers, error events and performance metrics.',
      'Tanergy may collect product usage data such as sign-in events, board open/save events, AI run status, upload state, plan-limit events, invite actions, admin actions, feature usage and security events.',
      'Tanergy may infer approximate location from IP address for security, abuse prevention, fraud detection, region-specific legal obligations and operational diagnostics.',
      'Cookies and similar technologies may be used for authentication, security, session continuity, preferences, analytics and product reliability. Marketing or optional analytics cookies should be controlled through a consent mechanism where required by law.',
    ],
  },
  {
    title: '4. Information from third parties',
    body: [
      'If you sign in through Clerk, Google or another identity provider, Tanergy may receive information such as your email address, name, profile image, authentication identifier and verification status.',
      'Payment providers may send Tanergy payment confirmations, checkout identifiers, subscription status, invoice metadata, refund status, chargeback information and tax-related records needed to operate paid plans.',
      'AI providers may return generated outputs, moderation signals, error messages, provider request identifiers, cost metadata and runtime status needed to complete or audit an AI run.',
      'Business, security, analytics or infrastructure providers may provide operational information that helps Tanergy detect abuse, secure accounts, debug incidents and improve the product.',
    ],
  },
  {
    title: '5. How Tanergy uses information',
    body: [
      'Tanergy uses information to create and secure accounts, provide the canvas, save boards, store assets, run AI features, support collaboration, manage invitations, enforce workspace permissions and operate public sharing.',
      'Tanergy uses information to quote AI runs, resolve whether a run charges a personal wallet or Team wallet, record usage, prevent double charging, provide usage history and support plan-limit enforcement.',
      'Tanergy uses information to provide support, troubleshoot bugs, monitor performance, investigate incidents, prevent fraud or abuse, enforce policies, comply with law and defend legal rights.',
      'Tanergy may use aggregated or de-identified data to understand product usage, improve reliability, plan capacity, evaluate feature quality and make business decisions. Aggregated or de-identified data should not reasonably identify an individual.',
      'Tanergy does not sell personal information. Tanergy does not use private customer boards, uploaded assets or prompts to train foundation models unless a separate written agreement or explicit opt-in says otherwise.',
    ],
  },
  {
    title: '6. Legal bases',
    body: [
      'Where GDPR, UK GDPR or similar laws apply, Tanergy may process data to perform a contract, including account creation, board storage, AI generation, collaboration, support, billing and security.',
      'Tanergy may process data for legitimate interests such as product security, fraud prevention, service reliability, debugging, abuse detection, analytics, product improvement and legal defense, where those interests are not overridden by user rights.',
      'Tanergy may process data to comply with legal obligations, including tax, accounting, sanctions, consumer protection, fraud prevention, lawful requests, audit obligations and data subject rights.',
      'Tanergy relies on consent where required, such as optional marketing, optional cookies, optional surveys, or features that require additional permission. Consent may be withdrawn where applicable.',
    ],
  },
  {
    title: '7. AI processing and provider disclosure',
    body: [
      'When you run an AI feature, Tanergy may send prompts, selected images, canvas context, model settings and related metadata to the configured AI provider so the provider can return the requested output.',
      'AI providers may process data in their own infrastructure and may apply safety, abuse, rate-limit, logging or policy systems. Their own terms and privacy policies may also apply.',
      'Tanergy should keep production AI provider keys server-side. Browser code must not expose provider secrets, database credentials, payment secrets or private operator notes.',
      'Generated outputs may be stored as assets and linked back into boards. Board documents should store compact references and summaries rather than raw Base64 images, full provider payloads or complete logs.',
    ],
  },
  {
    title: '8. Collaboration, sharing and administrators',
    body: [
      'Workspace owners and admins control who can access their Team or Group workspaces. Board owners and people with sufficient permission can share boards, invite members, revoke access and create public share links when the feature is enabled.',
      'If you join another person or organization’s workspace, your access, role and content in that workspace may be controlled by that workspace owner or administrator.',
      'Public share links should be treated as sensitive links. Anyone with a valid public share link may be able to view the shared board until the link expires or is revoked.',
      'Developer administrators may access account, workspace, billing, usage, audit and support information only as needed to operate, secure, debug or support the service. Administrative writes should be audited.',
    ],
  },
  {
    title: '9. How information is shared',
    body: [
      'Tanergy may share information with service providers for hosting, database, object storage, authentication, email, logging, analytics, payment processing, tax, customer support, security and AI generation.',
      'Tanergy may share information with workspace members according to product permissions, including board content, member names, roles, comments, presence indicators, invite status and shared asset references.',
      'Tanergy may disclose information when required by law, subpoena, court order, regulator request, law enforcement request, security incident investigation, fraud prevention, policy enforcement or legal claim.',
      'Tanergy may transfer information in connection with a merger, acquisition, financing, reorganization, sale of assets or similar business transaction, subject to appropriate confidentiality and continuity protections.',
      'Tanergy may share information with your consent, at your direction, or when you intentionally connect or enable a third-party integration.',
    ],
  },
  {
    title: '10. Security',
    body: [
      'Tanergy uses administrative, technical and organizational measures intended to protect accounts, boards, assets, credentials and service systems. These measures may include access controls, authentication, encryption in transit, scoped service credentials, logging, backups and internal review.',
      'No internet service can guarantee perfect security. You are responsible for keeping your account credentials safe, using strong authentication where available and limiting share links or invitations to intended recipients.',
      'If Tanergy becomes aware of a security incident that affects personal data, it will assess the incident and provide notifications where required by law.',
    ],
  },
  {
    title: '11. Retention and deletion',
    body: [
      'Tanergy keeps account, workspace, board, asset, billing, usage and audit records for as long as needed to provide the service, comply with law, resolve disputes, prevent abuse, enforce agreements and maintain security.',
      'Users may request account deletion. Deletion may be blocked or delayed when the account still owns Team or Group workspaces, active subscriptions, active Team seats, pending invites or other records that must first be transferred, canceled or cleared.',
      'Deleted boards, assets or accounts may remain in backups, logs or audit records for a limited period before normal retention schedules remove them. Some records may be retained longer for tax, fraud, security, legal or audit reasons.',
      'Generated outputs and uploaded assets associated with shared workspaces may remain available to other authorized workspace members if deletion would disrupt a shared workspace record, unless applicable law requires otherwise.',
    ],
  },
  {
    title: '12. International transfers',
    body: [
      'Tanergy may use providers located in different countries for hosting, authentication, database, object storage, email, analytics, payments, support and AI generation.',
      'If personal data is transferred from the UK, EEA, Switzerland or another regulated region to a country without an adequacy decision, Tanergy should use appropriate safeguards such as standard contractual clauses, UK addenda or other legally recognized transfer mechanisms where required.',
      'Before public paid launch, Tanergy should maintain a current subprocessor list that identifies key infrastructure, AI, authentication, storage, email and payment providers.',
    ],
  },
  {
    title: '13. Your choices and rights',
    body: [
      'Depending on your location, you may have rights to access, correct, delete, export, restrict or object to processing of personal data, withdraw consent, opt out of certain marketing or targeted advertising, and complain to a data protection authority.',
      'You can update some account and workspace information directly in the product. Workspace owners and admins can manage members, roles, invitations and board sharing through product controls.',
      'To exercise privacy rights, contact the support or privacy channel published by Tanergy. Tanergy may need to verify your identity and may decline or limit a request where permitted by law, such as when records must be retained for legal, security or fraud-prevention reasons.',
    ],
  },
  {
    title: '14. Children and sensitive data',
    body: [
      'Tanergy is not intended for children. Users must meet the minimum age required by applicable law and by the active identity, payment and AI providers.',
      'Do not upload sensitive personal data, government identifiers, medical records, biometric identifiers, financial account details, private images of other people or confidential third-party data unless you have the legal right and operational safeguards to do so.',
      'If a parent, guardian, school or organization believes a child or unauthorized person has submitted personal data, they should contact Tanergy so the account or content can be reviewed.',
    ],
  },
  {
    title: '15. Changes and contact',
    body: [
      'Tanergy may update this Privacy Policy as the product, providers, laws or business model change. Material changes should be communicated through the website, product, email or another reasonable method.',
      'The last updated date indicates when this version was prepared. Continued use of the service after an update may mean the revised policy applies, subject to rights that cannot be waived under applicable law.',
      'Before paid launch, this section must include the final operator name, registered address, privacy email and any required representative or data protection contact.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      intro="This Privacy Policy describes how Tanergy handles account, canvas, asset, collaboration, AI, support and beta billing data. It is a product-specific draft that should receive final legal review before paid launch."
      sections={sections}
      title="Privacy Policy"
    />
  )
}

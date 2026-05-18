import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service | Tanergy',
  description: 'Tanergy terms for the AI image canvas, workspaces, assets, collaboration, credits and beta billing.',
}

const sections = [
  {
    title: '1. Agreement to these terms',
    body: [
      'These Terms of Service govern access to Tanergy, including the website, AI image canvas, workspaces, boards, asset storage, collaboration features, AI generation, usage and billing surfaces, admin-operated support flows and any related services.',
      'By accessing or using Tanergy, you agree to these Terms, the Privacy Policy, the AI Content and Community Policy, and any additional terms presented in the product. If you use Tanergy for an organization, you represent that you have authority to bind that organization.',
      'Tanergy is currently in private beta. Features, limits, model availability, collaboration behavior, pricing, payment support and commercial terms may change before general availability.',
    ],
  },
  {
    title: '2. Accounts and eligibility',
    body: [
      'You must provide accurate account information and keep it current. You are responsible for protecting your login credentials and for activity that occurs under your account.',
      'You must meet the minimum age required by applicable law and by the identity, payment and AI providers used by Tanergy. Tanergy may refuse, suspend or terminate accounts that appear unauthorized, fraudulent, abusive or ineligible.',
      'If your account is connected to a company, school, Team or Group workspace, workspace owners or administrators may control your access, role and content within that workspace.',
    ],
  },
  {
    title: '3. Workspaces, boards and administrators',
    body: [
      'Tanergy supports personal workspaces, Group workspaces and Team workspaces. Workspace roles, board roles and billing authority are separate. A person may be able to edit a board without being allowed to manage billing or invite members.',
      'Workspace owners and admins are responsible for choosing the right members, assigning roles, removing access when needed and ensuring workspace content is lawful and authorized.',
      'If you are invited into another workspace, your access to that workspace and content you add there may be controlled by the workspace owner or administrator.',
      'Public share links and invite links should be shared only with intended recipients. Tanergy is not responsible for unauthorized access caused by a user sharing a link outside the intended audience.',
    ],
  },
  {
    title: '4. Your content',
    body: [
      'Your content includes boards, pages, nodes, prompts, uploaded images, generated images, annotations, comments, asset metadata, workspace names and other material you submit, create, store or share through Tanergy.',
      'You retain ownership of your content, subject to any rights held by others and the license granted here. You grant Tanergy a non-exclusive, worldwide, royalty-free license to host, store, copy, transmit, display, process, transform, analyze, back up and create technical derivatives of your content only as needed to provide, secure, support and improve the service.',
      'You represent that you have all rights, permissions and notices required to upload, process, edit, generate, publish or share your content, including rights for images, prompts, brand assets, names, likenesses, datasets, confidential material and third-party works.',
      'Tanergy does not claim ownership of your private boards or assets. Tanergy does not use private customer boards, prompts or uploads to train foundation models unless a separate written agreement or explicit opt-in says otherwise.',
    ],
  },
  {
    title: '5. AI inputs and outputs',
    body: [
      'AI inputs include prompts, uploaded images, selected board context, model settings and instructions sent to an AI feature. AI outputs include generated images, edits, analysis text, prompt rewrites and other responses returned by an AI feature.',
      'AI outputs may be inaccurate, unexpected, offensive, similar to other outputs, legally restricted or unsuitable for a particular use. You are responsible for reviewing outputs before using, publishing, selling or relying on them.',
      'Tanergy does not guarantee that AI outputs are unique, copyrightable, non-infringing, commercially safe, factually accurate or cleared for your intended use. You are responsible for legal review, rights clearance, disclosure and customer approval where needed.',
      'You should disclose AI generation or editing when law, platform rules, customer contracts, professional standards or the AI Content and Community Policy require it.',
    ],
  },
  {
    title: '6. Prohibited use',
    body: [
      'You may not use Tanergy to violate law, infringe intellectual property or privacy rights, impersonate others, deceive people, harass, threaten, exploit, defraud, distribute malware, bypass security controls or interfere with the service.',
      'You may not upload or generate sexual content involving minors, non-consensual intimate imagery, exploitative sexual content, graphic abuse, terrorist content, hateful content, instructions for wrongdoing, or content that meaningfully facilitates violence, fraud or illegal activity.',
      'You may not use Tanergy for biometric identification, face recognition of private people, surveillance, high-risk automated decisions, legal/medical/financial determinations about a person, or other sensitive uses unless Tanergy has expressly agreed in writing and the use is lawful.',
      'You may not scrape, reverse engineer, benchmark, overload, resell, sublicense, share seats, bypass plan limits, attempt to access non-public APIs or use Tanergy to build a competing service except where applicable law gives you a non-waivable right.',
    ],
  },
  {
    title: '7. Plans, credits and beta payment boundary',
    body: [
      'Public pricing may be shown before live checkout is available. Displayed beta prices are product planning information unless a live checkout page clearly confirms paid service is active.',
      'During private beta, billing flows may be manual, mocked, disabled or limited. Tanergy may grant free registration credits, plan credits, top-up credits or test credits, and may change or revoke beta credits where necessary to prevent abuse or correct errors.',
      'When paid plans are enabled, credits may be consumed by AI runs, image generation, image editing, analysis, storage, seat grants or other metered actions described in the product. Consumed compute-heavy credits may be non-refundable except where required by law or provider rules.',
      'Team plans use a Team wallet. Group and personal plans use the acting user’s personal wallet. Group workspaces are collaboration structures and do not create a shared Group wallet unless Tanergy later publishes a different plan.',
    ],
  },
  {
    title: '8. Taxes, invoices and payment providers',
    body: [
      'Live checkout, tax calculation, invoices, refunds, payment-provider routing and merchant-of-record handling are not active in the private beta unless the checkout screen explicitly states otherwise.',
      'When Tanergy enables paid service, payments may be processed by third-party providers. Those providers may have their own terms, privacy policies, tax rules, refund processes, chargeback processes and verification requirements.',
      'You are responsible for taxes, duties, bank fees, foreign exchange costs and other charges that apply to your purchase unless the active payment provider or checkout flow states otherwise.',
    ],
  },
  {
    title: '9. Collaboration and shared content',
    body: [
      'When you add content to a shared workspace or board, other authorized members may view, edit, copy, comment on or export that content according to their permissions.',
      'If you remove a member, revoke an invite or delete a board, some records may remain in history, audit logs, backups, billing records or other members’ derived work where permitted by law and needed for service integrity.',
      'Tanergy may provide presence, cursor, draft drawing or activity indicators to support collaboration. These indicators are operational features and may not be perfectly real time.',
    ],
  },
  {
    title: '10. Third-party services',
    body: [
      'Tanergy may rely on third-party services for identity, hosting, database, object storage, AI generation, email, analytics, support, payment processing, tax, monitoring and security.',
      'Third-party services may be subject to their own terms and privacy policies. Tanergy is not responsible for third-party platforms that you choose to connect, content you send to them, or changes in their availability, pricing, policies or outputs.',
      'If an AI provider, payment provider or infrastructure provider is unavailable, rate-limited or rejects a request, Tanergy may delay, cancel, retry, fail over or decline the affected operation.',
    ],
  },
  {
    title: '11. Suspension and termination',
    body: [
      'Tanergy may suspend, limit or terminate access to an account, workspace, board, AI feature, share link, payment flow or asset if Tanergy believes there is a policy violation, legal risk, security risk, payment issue, abuse, fraud, harmful content or threat to service integrity.',
      'Where practical, Tanergy may give notice and an opportunity to resolve the issue, but Tanergy may act immediately where notice would create risk, violate law, compromise security or harm users or providers.',
      'You may stop using Tanergy at any time and may request account deletion through the product or support channel. Deletion may require clearing ownership, subscription, seat, invite or legal blockers before it can be completed.',
    ],
  },
  {
    title: '12. Export and data loss',
    body: [
      'Tanergy may provide export, share, copy or package features for boards and assets. Export features may be limited by plan, workspace permission, asset state, storage availability or product readiness.',
      'You are responsible for keeping backups of content you need to preserve outside Tanergy. Tanergy does not guarantee that every draft, generation, preview, deleted board, expired share link or historical version will remain recoverable.',
      'After account termination, workspace deletion or subscription expiration, Tanergy may delete or restrict access to content according to product settings, retention schedules, legal obligations and backup processes.',
    ],
  },
  {
    title: '13. Intellectual property and feedback',
    body: [
      'Tanergy and its licensors own the service, software, website, design, logos, documentation, model routing systems, plan catalog systems, admin tools and other platform materials, excluding your content.',
      'You may not remove proprietary notices, copy protected parts of the service, misuse Tanergy branding or claim endorsement by Tanergy without permission.',
      'If you provide feedback, suggestions, bug reports or feature ideas, Tanergy may use them without restriction or compensation, while you retain ownership of any underlying content you submit separately.',
    ],
  },
  {
    title: '14. Disclaimers',
    body: [
      'Tanergy is provided as-is and as-available during beta. Tanergy does not warrant that the service will be uninterrupted, error-free, secure, compliant with every customer requirement, or that AI outputs will meet your expectations.',
      'Tanergy does not provide legal, tax, accounting, financial, medical, professional, copyright clearance or brand-safety advice. You should obtain professional advice for those matters.',
      'Some jurisdictions do not allow certain disclaimers, so parts of this section may not apply to you.',
    ],
  },
  {
    title: '15. Liability and indemnity',
    body: [
      'To the maximum extent permitted by law, Tanergy will not be liable for indirect, incidental, special, consequential, exemplary or punitive damages, lost profits, lost revenue, lost data, business interruption, reputational harm or loss arising from use of the service.',
      'Before paid launch, the final operator should insert a legally reviewed liability cap. A common SaaS pattern is to cap liability at amounts paid during a defined period, but the final number and exclusions must be reviewed by counsel.',
      'You agree to defend and indemnify Tanergy against claims, losses, liabilities, damages, costs and expenses arising from your content, your AI inputs or outputs, your breach of these Terms, your violation of law, or your infringement of third-party rights, where permitted by law.',
    ],
  },
  {
    title: '16. Changes, governing law and contact',
    body: [
      'Tanergy may update these Terms as the product, providers, laws, pricing and business model change. Material changes should be communicated through the website, product, email or another reasonable method.',
      'The final governing law, dispute forum, operator entity, registered address and legal contact must be inserted before paid launch. Those choices should match the actual company, payment provider and customer market.',
      'If you do not agree to updated Terms, you should stop using Tanergy. Continued use after the effective date may mean the updated Terms apply, subject to rights that cannot be waived by contract.',
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      intro="These Terms describe the beta relationship between Tanergy and people or organizations using the AI image canvas. They are detailed product-specific draft terms and should be reviewed before commercial launch."
      sections={sections}
      title="Terms of Service"
    />
  )
}

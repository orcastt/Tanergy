import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'AI Content and Community Policy | Tanergy',
  description: 'Tanergy policy for AI image generation, uploads, collaboration, community behavior and content safety.',
}

const sections = [
  {
    title: '1. Purpose',
    body: [
      'This AI Content and Community Policy explains what people may and may not do with Tanergy’s AI image canvas, uploads, prompts, generated outputs, image editing, analysis, collaboration and sharing features.',
      'This policy applies to prompts, uploaded images, generated images, edited images, analysis text, chat instructions, board content, comments, share links, workspace invitations and any other content or behavior connected to Tanergy.',
      'This policy is part of the Terms of Service. If there is a conflict between this policy and a stricter product notice, provider policy or law, the stricter rule may apply.',
    ],
  },
  {
    title: '2. Allowed creative use',
    body: [
      'Tanergy is designed for visual ideation, image generation, image editing, reference exploration, creative direction, board-based planning, product concepts, marketing drafts, annotations, merge captures, analysis and team collaboration.',
      'You may use content you own, content you are licensed to use, public-domain material, properly authorized brand assets, properly authorized personal likenesses and other material you have the right to process.',
      'Commercial use may be possible only when you have independently confirmed the rights, releases, disclosure duties, contract obligations and platform rules that apply to your use case.',
    ],
  },
  {
    title: '3. User responsibility',
    body: [
      'You are responsible for your prompts, uploads, instructions, board content, generated outputs and how you use or publish them.',
      'You must review outputs before external use. AI systems can hallucinate details, distort images, produce similar outputs for different users, or generate content that is unsuitable for a customer, brand, market or legal context.',
      'Do not assume an output is copyrightable, exclusive, non-infringing, accurate, safe for advertising, cleared for a person’s likeness, or accepted by a marketplace merely because Tanergy generated it.',
    ],
  },
  {
    title: '4. Rights, likeness and attribution',
    body: [
      'Do not upload, edit or generate content that violates copyright, trademark, design rights, trade secrets, privacy rights, publicity rights, confidentiality obligations, platform terms or contractual restrictions.',
      'Do not use a private person’s face, body, voice, name, identity, workplace, address or other identifying details without permission, especially for realistic outputs, endorsements, advertisements, adult content, political content or harmful claims.',
      'Do not imply that a person, brand, artist, company, public figure or organization created, endorsed, approved or sponsored an output unless that is true and authorized.',
      'Where required by law, contract, platform policy or professional standard, disclose that content was generated or materially edited with AI.',
    ],
  },
  {
    title: '5. Disallowed sexual and exploitative content',
    body: [
      'Do not create, request, upload, edit, share or distribute sexual content involving minors or anyone who appears to be a minor.',
      'Do not create non-consensual intimate imagery, sexual deepfakes, exploitative sexual content, voyeuristic content, sexual blackmail material, or content that sexualizes a person without clear permission.',
      'Do not use Tanergy to harass, shame, threaten, coerce or exploit another person through sexualized content or manipulated imagery.',
    ],
  },
  {
    title: '6. Violence, hate and abuse',
    body: [
      'Do not generate or share graphic abuse, sadistic violence, terrorist propaganda, extremist recruitment, credible threats, instructions for violent wrongdoing or content that celebrates real-world harm.',
      'Do not create hateful, dehumanizing, intimidating or exclusionary content targeting people or groups based on protected characteristics such as race, ethnicity, nationality, religion, caste, sex, gender identity, sexual orientation, disability, age or veteran status.',
      'Do not use Tanergy to coordinate harassment, doxxing, stalking, intimidation, brigading or abuse of individuals, communities, creators or organizations.',
    ],
  },
  {
    title: '7. Deception, fraud and misinformation',
    body: [
      'Do not create realistic images, documents, screenshots, receipts, IDs, invoices, certificates, news scenes or conversations intended to deceive people, commit fraud, impersonate others or misrepresent evidence.',
      'Do not generate political persuasion content, crisis imagery, disaster footage, medical claims, financial claims or news-like content in a way that could mislead people about real events or factual claims.',
      'Do not remove, obscure or misrepresent required watermarks, provenance metadata, safety labels or AI disclosures when they are provided or required.',
    ],
  },
  {
    title: '8. High-risk and regulated uses',
    body: [
      'Do not use Tanergy outputs to make legal, medical, financial, employment, housing, insurance, credit, immigration, education, law-enforcement or similarly significant decisions about a person.',
      'Do not use Tanergy for surveillance, biometric identification, face recognition, emotion recognition, background checks, fraud scoring or sensitive profiling unless Tanergy has expressly agreed in writing and the use is lawful.',
      'Do not upload regulated data such as health records, government identifiers, biometric templates, payment account details, trade secrets, export-controlled material or confidential client data unless you have permission and appropriate safeguards.',
    ],
  },
  {
    title: '9. Illegal activity and platform abuse',
    body: [
      'Do not use Tanergy to create malware, phishing material, scams, forged documents, evasion instructions, weapons instructions, illegal drug instructions, self-harm encouragement or other content that facilitates wrongdoing.',
      'Do not attempt to bypass model safeguards, abuse rate limits, automate account creation, scrape non-public APIs, overload the service, probe security systems, steal assets or evade plan limits.',
      'Do not resell, sublicense or provide Tanergy as a hidden service to third parties unless a written agreement allows it.',
    ],
  },
  {
    title: '10. Collaboration and community conduct',
    body: [
      'Treat collaborators with respect. Do not use boards, comments, prompts, shares, invites or generated content to harass, threaten, humiliate, spam, manipulate or exclude people.',
      'Workspace owners and admins are responsible for setting member roles, removing abusive members, revoking unsafe links and reporting serious misuse.',
      'If you invite someone into a workspace, make sure they are authorized to see the boards, assets, prompts, customer materials and generated outputs in that workspace.',
    ],
  },
  {
    title: '11. Moderation and enforcement',
    body: [
      'Tanergy may use automated checks, provider-side checks, abuse reports, rate limits, manual review and audit logs to detect unsafe, infringing or unauthorized use.',
      'Tanergy may block prompts, refuse uploads, disable generation, remove content, revoke share links, suspend accounts, limit workspaces, preserve evidence, notify workspace owners or report unlawful activity where appropriate.',
      'Moderation systems are imperfect. Tanergy may fail to detect some violations or may incorrectly block allowed content. Users can contact support if they believe enforcement was mistaken.',
    ],
  },
  {
    title: '12. Reports and rights complaints',
    body: [
      'Report suspected abuse, rights violations, unsafe outputs, non-consensual imagery, impersonation or illegal content through the support channel with the board link, asset link, screenshots, user details if known and a short explanation.',
      'Rights holders should identify the allegedly infringing content, explain the rights at issue, provide contact information and include any information needed to evaluate the claim.',
      'Tanergy may remove or restrict content during review, ask for additional information, restore content if a report appears mistaken, or terminate repeat or serious violators.',
    ],
  },
  {
    title: '13. Publishing and commercial review',
    body: [
      'Before publishing or selling AI-generated or AI-edited content, review it for rights, likeness, brand safety, factual claims, required disclosures, customer approvals, marketplace rules and local law.',
      'For client work, keep records of source materials, permissions, prompts, model settings, reviews and final approvals when your customer or industry requires them.',
      'For sensitive campaigns, legal, regulated industries, public figures, children, political content, medical claims or financial claims, obtain professional review before external use.',
    ],
  },
  {
    title: '14. Provider policy and product limits',
    body: [
      'Tanergy’s AI providers may apply their own safety and acceptable-use policies. A provider may refuse, filter, rate limit or change outputs even if Tanergy would otherwise allow the request.',
      'Plan limits, model availability, content filters, moderation rules and generation quality may change during beta as Tanergy improves safety, cost control and reliability.',
      'If a feature is marked beta, experimental, local-only, mock, manual or disabled, do not rely on it as a production commitment.',
    ],
  },
  {
    title: '15. Changes to this policy',
    body: [
      'Tanergy may update this policy as AI law, provider requirements, payment-provider requirements, safety practices and product capabilities change.',
      'Material changes should be communicated through the website, product, email or another reasonable method. Continued use after the effective date may mean the updated policy applies.',
    ],
  },
]

export default function AiPolicyPage() {
  return (
    <LegalPage
      intro="This policy sets Tanergy’s baseline for AI image generation, image editing, uploads, analysis, collaboration, sharing and community safety. It is intentionally strict while the product is in private beta."
      sections={sections}
      title="AI Content and Community Policy"
    />
  )
}

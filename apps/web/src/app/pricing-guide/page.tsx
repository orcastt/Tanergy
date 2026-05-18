import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Plan and Billing Guide | Tanergy',
  description: 'Tanergy guide to personal plans, Group collaboration, Team workspaces, wallets, credits and beta billing boundaries.',
}

const sections = [
  {
    title: '1. Purpose of this guide',
    body: [
      'This Plan and Billing Guide explains how Tanergy plans, workspaces, wallets, credits, collaboration rights and beta payment boundaries are intended to work.',
      'It is written to clarify the difference between Personal, Group and Team usage. It supplements the Pricing page, Terms of Service, Privacy Policy and AI Content and Community Policy.',
      'Tanergy is currently in private beta. Checkout, invoices, tax handling, provider routing, credit amounts and plan limits may change before paid launch. If a live checkout screen or signed order conflicts with this guide, that checkout screen or signed order controls for that purchase.',
    ],
  },
  {
    title: '2. Short definitions',
    body: [
      'A Private board is an individual board owned and managed by one user inside that user’s personal workspace. It does not need member invitations, invite links, owner/editor/viewer management or shared billing.',
      'A Group workspace is a lightweight collaboration space for people who want to share boards but still keep AI spending on each person’s own personal wallet. Group is best for informal collaboration, contractors, class projects, friends, early client review or shared inspiration boards.',
      'A Team workspace is an organization-style workspace with seats, Team-owned boards and a shared Team wallet. Team is best when one business, studio, department or client account wants central billing and workspace-level spend control.',
      'An Enterprise plan is a custom agreement for larger organizations that need negotiated credits, support, security review, onboarding, governance, custom limits or payment paperwork.',
    ],
  },
  {
    title: '3. Wallet rules',
    body: [
      'Personal plans use a personal wallet. AI runs started by the user on Private boards or Group boards are charged to the acting user’s personal credits unless the product clearly says otherwise.',
      'Group workspaces do not create a shared Group wallet. A Group lets multiple people collaborate on boards, but each collaborator keeps responsibility for their own AI usage and personal credit balance.',
      'Team plans use a Team wallet. AI runs on Team-owned boards are charged to the Team wallet when the actor has an active Team seat and the workspace entitlement allows the run.',
      'If a user belongs to multiple workspaces, the wallet is determined by the workspace and board context where the AI run is started. Switching from a personal or Group board to a Team board can change which wallet pays.',
      'If an entitlement, seat, wallet or subscription is paused, exhausted or invalid, Tanergy may block AI runs, request an upgrade, request a top-up or show a plan-limit message.',
    ],
  },
  {
    title: '4. Personal plans',
    body: [
      'Free Canvas is the private beta entry plan. It is intended for first boards, product testing and a limited personal canvas envelope.',
      'Collaborate Start and Collaborate Plus are personal plans. They increase the user’s personal credits and personal collaboration capacity while still keeping payment and AI usage attached to that user’s personal wallet.',
      'Personal plan credits are not automatically pooled with other users. Inviting someone to a Group board does not give them access to your personal wallet unless Tanergy later ships an explicit shared-wallet feature.',
      'Personal plan limits may include board count, page count, Group workspace count, asset storage, AI credits, history depth, upload size, export support, collaboration capacity and access to advanced models.',
    ],
  },
  {
    title: '5. Group workspaces',
    body: [
      'Group is for collaboration without shared billing. It gives people a shared place to work, but it avoids the accounting complexity of one person paying for everyone’s AI generations.',
      'A Group owner or admin may invite members, choose roles, revoke links and manage Group access. These roles control workspace and board permissions, not the other members’ personal wallets.',
      'When a Group member creates or edits a board, the board remains inside the Group workspace. Other members can access it according to their permissions, but AI credit charges still follow the acting user’s personal wallet unless a future product notice says otherwise.',
      'Group is useful when the people collaborating do not belong to the same billing organization, or when a project wants shared visual work but each person should carry their own AI usage.',
    ],
  },
  {
    title: '6. Team workspaces',
    body: [
      'Team is for shared billing and organizational control. A Team has seats, Team-owned boards and a Team wallet that pays for eligible AI usage inside that Team workspace.',
      'A Team owner controls the Team plan, seats and workspace ownership. Team admins may help manage members and boards, but owner-only actions may remain reserved to the owner for deletion, billing, legal or security reasons.',
      'If an admin creates a board inside a Team, the Team owner retains ultimate ownership visibility and control under Tanergy’s Team governance model. Admin-created Team boards should not become invisible to the owner.',
      'Team member access can be limited by seat count, role, plan status, workspace status, credit balance, security rules or policy enforcement. Removing a member may remove future access but may not erase audit, billing or historical records.',
    ],
  },
  {
    title: '7. Roles and rights',
    body: [
      'Workspace roles and board roles are related but not identical. A user may be a workspace viewer, editor, admin or owner, and may also have board-specific permissions.',
      'Viewers can generally open and review content. Editors can generally edit allowed boards. Admins can generally manage members and workspace settings where the plan allows it. Owners retain highest-level control, including sensitive deletion and billing-related authority.',
      'Private boards are intentionally simpler. Private board management should show the individual owner’s information and personal board facts, not Team-style member invitation controls.',
      'Tanergy may restrict dangerous or irreversible actions, such as deleting a shared board, to owners even when admins have broad management rights.',
    ],
  },
  {
    title: '8. Credits and usage',
    body: [
      'Credits represent product usage capacity, not cash stored in an account. Credits may be granted by registration, subscription, top-up, Team seat, manual adjustment, promotion, refund correction or beta test allocation.',
      'AI image generation, image editing, analysis, prompt optimization, future export features, high-resolution renders or other compute-heavy actions may consume credits according to model, size, output count, provider cost, plan and product policy.',
      'Image Gen usually requests one output. Image Gen 4 requests four outputs and can therefore consume more credits or take longer, depending on the selected model and tier.',
      'If a run fails before provider work begins, Tanergy may avoid charging or may reverse the ledger entry. If provider work begins and compute is consumed, credits may be non-refundable unless the active policy or law requires otherwise.',
    ],
  },
  {
    title: '9. Page, board and storage limits',
    body: [
      'Plan limits protect product reliability and cost. They may include the number of boards, pages per board, members, Team seats, Group workspaces, saved assets, AI credits, concurrent runs, upload size and history depth.',
      'For Team and Group boards, Tanergy may enforce a page cap to keep collaboration responsive. When the limit is reached, the product should show a clear plan-limit message instead of silently creating more pages.',
      'Asset storage and image generation are separate resources. Database disk is used for structured records such as users, boards, workspaces, roles and ledgers. Object storage is used for image files and generated assets.',
    ],
  },
  {
    title: '10. Beta payment boundary',
    body: [
      'During private beta, public prices are planning information unless live checkout is explicitly enabled. Tanergy may show plan cards, pricing copy and upgrade paths before real payment collection is turned on.',
      'Live checkout, taxes, invoices, refunds, subscription renewals, merchant-of-record routing, chargebacks and payment provider review are intentionally gated until Tanergy completes commercial, legal and content-safety readiness.',
      'When paid service is enabled, the active payment provider may determine accepted countries, currencies, tax treatment, invoice format, payout timing, refund mechanics, risk review and account verification requirements.',
    ],
  },
  {
    title: '11. Changes and conflicts',
    body: [
      'Tanergy may update plans, names, limits, credit amounts, prices, model availability, role permissions and billing rules as the product moves from private beta to paid launch.',
      'If a plan is renamed, Tanergy may migrate users to an equivalent or successor plan where reasonable. If a feature is removed, paused or replaced, Tanergy may provide notice, migration instructions or alternatives where practical.',
      'Before public paid launch, this guide should be reviewed with the final payment provider, legal entity, tax approach and customer terms so the public plan language matches the actual checkout and invoice flow.',
    ],
  },
]

export default function PricingGuidePage() {
  return (
    <LegalPage
      intro="This guide explains how Tanergy separates personal plans, Group collaboration, Team workspaces, wallets, credits and beta billing. It is intentionally plain-language so users can understand who pays for what before they sign up."
      label="Plan and billing guide"
      sections={sections}
      title="Plan and Billing Guide"
    />
  )
}

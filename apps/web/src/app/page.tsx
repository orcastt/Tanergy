import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-card">
        <p className="eyebrow">TANGENT P0</p>
        <h1>Web AI image canvas reset</h1>
        <p>
          Step 1 starts with a focused tldraw spike: whiteboard tools, AI node cards, images,
          link cards, arrows, and coordinate checks.
        </p>
        <Link href="/spikes/canvas">Open Canvas Spike</Link>
      </section>
    </main>
  )
}

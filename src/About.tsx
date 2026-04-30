import { useEffect, useRef, useState } from 'react'
import './About.css'

function useScrollProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const scrolled = el.scrollTop
      const total = el.scrollHeight - el.clientHeight
      setProgress(total > 0 ? scrolled / total : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return progress
}

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

function RevealSection({ children, className = '', delay = 0 }: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`reveal-wrap ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

const GitHubIcon = () => (
  <svg
    className="github-icon"
    viewBox="0 0 98 96"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
    />
  </svg>
)

export function About() {
  const scrollProgress = useScrollProgress()

  return (
    <main className="about-shell">
      <div className="scroll-progress-bar" style={{ transform: `scaleX(${scrollProgress})` }} />

      {/* ── top nav ── */}
      <header className="about-header">
        <a href="#" className="about-nav-back">← back to app</a>
        <span />
        <a
          href="https://github.com/audreyshin/FingerBang"
          target="_blank"
          rel="noopener noreferrer"
          className="about-nav-github"
          aria-label="GitHub repository"
        >
          <GitHubIcon />
        </a>
      </header>

      {/* ── hero ── */}
      <section className="about-hero about-hero--animated">
        <p className="about-hero-eyebrow">₊⊹ 𝜗ৎ wellesley college · tangible user interfaces</p>
        <h1 className="about-hero-title">FingerBang</h1>
        <p className="about-hero-tagline">A Wearable Gestural Interface for Accessible Music Production</p>
        <p className="about-hero-sub">
          bend your fingers to morph the music. swing your wrist to hit a drum.
          <br />no controller, no knob, just your hand.
        </p>
        <div className="about-hero-actions">
          <a className="about-hero-cta" href="#">open the controller ↗</a>
          <a
            className="about-hero-cta about-hero-cta--ghost"
            href="https://github.com/audreyshin/FingerBang"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubIcon /> source code
          </a>
        </div>
      </section>

      {/* ── team ── */}
      <RevealSection>
      <section className="about-section" id="team">
        <p className="about-section-label">˚꩜ meet the team</p>
        <h2 className="about-section-heading">the people behind the glove</h2>
        <div className="about-team-grid">

          <div className="about-team-card">
            <div className="about-team-photo-wrap">
              <img
                src="/images/team-audrey.jpeg"
                alt="Audrey Shin"
                className="about-team-photo"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="about-team-photo-placeholder">A</div>
            </div>
            <div className="about-team-info">
              <p className="about-team-name">Audrey Shin</p>
              <p className="about-team-role">Computer Science & Economics</p>
              <p className="about-team-bio">
                Senior at Wellesley College. I've been playing piano for 14 years and listen to music literally every day.
                I've always wanted to get into DJing after seeing it at parties, but the barrier to entry always felt too high,
                which is exactly what motivated this project.
              </p>
            </div>
          </div>

          <div className="about-team-card">
            <div className="about-team-photo-wrap">
              <img
                src="/images/team-rebecca.jpeg"
                alt="Rebecca Friedman"
                className="about-team-photo"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="about-team-photo-placeholder">R</div>
            </div>
            <div className="about-team-info">
              <p className="about-team-name">Rebecca Friedman</p>
              <p className="about-team-role">MAS & Psychology</p>
              <p className="about-team-bio">
                Senior at Wellesley College. Always listening to music, always chasing creative freedom.
                Drawn to projects that make technology feel expressive rather than technical.
              </p>
            </div>
          </div>

          <div className="about-team-card">
            <div className="about-team-photo-wrap">
              <img
                src="/images/team-erika.jpeg"
                alt="Erika Chen"
                className="about-team-photo"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="about-team-photo-placeholder">E</div>
            </div>
            <div className="about-team-info">
              <p className="about-team-name">Erika Chen</p>
              <p className="about-team-role">Media Arts & Sciences and Music</p>
              <p className="about-team-bio">
                Senior at Wellesley College. I've been playing an instrument since I was 11, music has been central to my
                everyday life ever since. I wanted to explore what's possible outside of traditional instrumental music and
                make the art form as innovative and accessible as possible for the next generation.
              </p>
            </div>
          </div>

        </div>
      </section>
      </RevealSection>

      {/* ── problem statement ── */}
      <RevealSection>
      <section className="about-section" id="problem">
        <p className="about-section-label">♡ problem statement</p>
        <h2 className="about-section-heading">the barrier is real</h2>
        <div className="about-body-stack">
          <p className="about-body">
            Electronic music production and DJing have never been more visible, house parties, college events, online platforms.
            But the cost of getting started hasn't really changed. Entry-level DJ controllers run $100 to $300.
            Intermediate setups hit $400 to $900. Professional standalone units go past $1,000. For a student doing this as a casual
            hobby, that price tag is just prohibitive.
          </p>
          <p className="about-body">
            And cost is only part of it. Traditional DJ hardware is dense, lots of inputs, spatial layouts that take real time
            to memorize, and a dedicated physical setup you can't just throw in a bag. The cognitive overhead of learning where
            everything is before you can even make something sound good is a real barrier on its own.
          </p>
          <p className="about-body">
            So there's a clear gap: people who want to engage with music production creatively but don't have the money or the
            context to use the tools that exist. FingerBang is designed for that gap, using the human hand as the controller.
            Portable, zero-cost compared to hardware, and expressive in a way a grid of buttons just isn't.
          </p>
        </div>
      </section>
      </RevealSection>

      {/* ── conceptual design ── */}
      <RevealSection>
      <section className="about-section" id="concept">
        <p className="about-section-label">⋆˚꩜｡⋆ conceptual design</p>
        <h2 className="about-section-heading">how the glove works as an interface</h2>
        <div className="about-body-stack">
          <p className="about-body">
            FingerBang is a wearable tangible user interface, instrumented gloves that translate hand gestures into real-time
            audio effects. Each finger maps to a discrete effect (reverb, bass adjustment, filter, flanger) via a flex sensor
            that reads how far you've bent that digit. The wrist-mounted IMU adds another dimension: a sharp wrist motion
            triggers a drum hit, layered on top of whatever's playing.
          </p>
          <p className="about-body">
            What makes this different from existing tangible music interfaces is the combination of portability, affordability,
            and actual learning support. No external hardware, no desk surface, no proprietary software. And critically,
            it has a real training mode, not just a playground, but something that teaches you <em>why</em> you'd apply a
            given effect at a given moment. Think Guitar Hero but for DJing: real-time cues tell you which effect to trigger
            and when, scaffolding the contextual logic of DJing in a way that trial-and-error just doesn't.
          </p>
          <p className="about-body">
            A typical session: put on the gloves, open the app, connect via USB. Select a track and a difficulty level,
            difficulty controls how many finger mappings are active, so beginners aren't overwhelmed.
            Curl your index finger to apply reverb. Swing your wrist to drop a drum hit. As you get better,
            enable more mappings and more nuanced combinations through the settings.
          </p>
        </div>

        <div className="about-image-block about-image-block--row">
          <div className="about-image-placeholder">
            <img
              src="/images/glove-sketch.png"
              alt="Glove design sketch and finger-to-effect mapping diagram"
              className="about-image"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <p className="about-image-label">glove design sketch, finger to effect mapping</p>
          </div>
          <div className="about-image-placeholder">
            <img
              src="/storyboard.PNG"
              alt="Storyboard"
              className="about-image"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <p className="about-image-label">storyboard</p>
          </div>
        </div>
      </section>
      </RevealSection>

      {/* ── design process ── */}
      <RevealSection>
      <section className="about-section" id="process">
        <p className="about-section-label">₊⊹ design process</p>
        <h2 className="about-section-heading">how we got here</h2>

        <div className="about-phase">
          <p className="about-phase-label">phase 01 — conceptual ideation</p>
          <p className="about-body">
            The core design question was: how do you keep the expressiveness of a real DJ controller while cutting the cost
            and the spatial requirements down to basically nothing? Early sketches centered on finger-based input, one digit,
            one effect. The glove form factor won out because it's ergonomically familiar, wearable anywhere, and doesn't
            require a surface.
          </p>
          <div className="about-image-block about-image-block--row">
            <div className="about-image-placeholder">
              <img
                src="/images/sketch-01.png"
                alt="Early concept sketch"
                className="about-image"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <p className="about-image-label">early concept sketch</p>
            </div>
            <div className="about-image-placeholder">
              <img
                src="/images/sketch-02.png"
                alt="Early concept prototype"
                className="about-image"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <p className="about-image-label">early concept prototype</p>
            </div>
          </div>
        </div>

        <div className="about-phase">
          <p className="about-phase-label">phase 02 — hardware prototyping</p>
          <p className="about-body">
            The first functional prototype was a single flex sensor on an Arduino Uno, sending raw bend data over USB serial.
            This iteration was intentionally scoped to validate just the data pipeline, reliable sensor ingestion, parsing,
            and live visualization, no audio yet. Sensor output came through as key-value pairs
            (<code>Raw:523, Min:498, Max:611, BiDirectional_Value:-37</code>) parsed by the React + TypeScript web app.
          </p>
          <p className="about-body" style={{ marginTop: '0.75rem' }}>
            After that was solid, we added the wrist accelerometer. We tried mapping wrist shake to a beat-repeat stutter effect
            using an AudioWorklet ring buffer, it technically worked but glitched constantly and was basically
            unperformable. So we scrapped it. Instead of modifying the music, the glove now just plays a drum sound <em>on top</em>
            of it, like a drumstick. Sharp swing = hit. That decision made everything click.
          </p>
          <div className="about-image-block about-image-block--small">
            <div className="about-image-placeholder">
              <img
                src="/images/updated-prototype.png"
                alt="Updated glove prototype"
                className="about-image"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <p className="about-image-label">updated glove prototype</p>
            </div>
          </div>
        </div>

        <div className="about-phase">
          <p className="about-phase-label">phase 03 — software platform</p>
          <p className="about-body">
            The current architecture separates serial connection, sensor parsing, state management, and UI rendering into clean
            layers, so adding new sensors or effects doesn't require restructuring everything. We built out the full deck system
            (10 tracks, two virtual decks, cue points, waveform display), the training mode, and a complete audio engine with
            filter, reverb convolver, and a hand-wired flanger using a Web Audio LFO oscillator driving the delay time.
          </p>
        </div>
      </section>
      </RevealSection>

      {/* ── demo ── */}
      <RevealSection>
      <section className="about-section" id="demo">
        <p className="about-section-label">⋆˚꩜ prototype demo</p>
        <h2 className="about-section-heading">see it in action</h2>
        <p className="about-body">
          A short demo showing the glove controlling live audio effects and the wrist-triggered drum hit.
        </p>
        <div className="about-video-frame">
          <iframe
            className="about-video"
            src="https://www.youtube.com/embed/NcWHzZKmbso"
            title="FingerBang functional prototype demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </section>
      </RevealSection>

      {/* ── github ── */}
      <RevealSection>
      <section className="about-section about-section--github" id="repo">
        <p className="about-section-label">୨୧ open source</p>
        <h2 className="about-section-heading">all the code is up</h2>
        <a
          href="https://github.com/audreyshin/FingerBang"
          target="_blank"
          rel="noopener noreferrer"
          className="about-github-btn"
        >
          <GitHubIcon />
          audreyshin / FingerBang
        </a>
      </section>
      </RevealSection>

      {/* ── footer ── */}
      <footer className="about-footer">
        <a href="#" className="about-footer-link">open the controller ↗</a>
      </footer>

    </main>
  )
}

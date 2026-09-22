"use client";

import Link from "next/link";
import Script from "next/script";
import "./story.css";

/**
 * The Ivory Standard "build story" — a scroll-driven canvas sequence ported
 * verbatim from handoff/ivory-build-story.html. The animation logic (vanilla
 * canvas + scroll listeners) and its sprite data are copied byte-for-byte into
 * static assets under public/how-its-built/ and loaded in order here, so the
 * 12.8MB sprite blob never enters the JS bundle and the motion behavior is
 * unchanged. Markup + CSS are the source's, with only two mechanical edits:
 * the closer CTA points at the real /address funnel, and the font vars resolve
 * to the app's next/font Fraunces/Inter (no duplicate Google Fonts link).
 * Sprites are the per-stage high-res .webp files under public/how-its-built/
 * sprites/, lazy-loaded inside story.js as each stage nears the viewport.
 */
export default function HowItsBuiltPage() {
  return (
    <div className="ivory-story">
      <section className="hero">
        <div className="eyebrow">IVORY STANDARD</div>
        <h1>See the Difference</h1>
        <p>
          Scroll through six stages of a real Ivory Standard install — steel post
          to finished stain — exactly how it goes into the ground behind your
          house.
        </p>
        <div className="scroll-cue">
          <span>SCROLL</span>
          <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2 5L7 10L12 5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </section>

      <div className="progress-rail" id="progressRail"></div>

      <main id="stages"></main>

      <section className="closer">
        <div className="eyebrow">GET YOUR PRICE</div>
        <h2>See your fence, priced in 90 seconds.</h2>
        <p>
          Draw your yard, pick Essential or Ivory Standard, and hold your price
          free for 14 days — no visit required to start.
        </p>
        <Link className="cta-btn" href="/address">
          Get your instant quote
        </Link>
      </section>

      <Script src="/how-its-built/story.js" strategy="afterInteractive" />
    </div>
  );
}

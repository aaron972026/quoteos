import Link from "next/link";
import styles from "./BuildHero.module.css";

/**
 * Homepage hero — Snippet 1 from handoff/ivory-build-integration-snippets.html,
 * ported verbatim. Full-bleed muted/looping build footage behind a scrim, with
 * the primary funnel CTA (/address) and a tease into the full build story
 * (/how-its-built). Video autoplays on iOS/Android because muted + playsInline
 * are both set — do not remove them.
 */
export function BuildHero() {
  return (
    <section className={styles.heroLoop}>
      <video autoPlay muted loop playsInline>
        <source src="/video/ivory-hero-loop.mp4" type="video/mp4" />
      </video>
      <div className={styles.content}>
        <div className={styles.eyebrow}>IVORY STANDARD</div>
        <h1>Built to a spec others won&apos;t touch.</h1>
        <p>
          Steel Postmaster posts, patented bracket-free rails, Alta Forest cedar —
          every fence backed in writing. See the whole build.
        </p>
        <div className={styles.actions}>
          <Link className={styles.btnPrimary} href="/address">
            Get your instant quote
          </Link>
          <Link className={styles.btnGhost} href="/how-its-built">
            Watch the full build
          </Link>
        </div>
      </div>
    </section>
  );
}

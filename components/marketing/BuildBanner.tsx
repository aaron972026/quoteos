import Link from "next/link";
import styles from "./BuildBanner.module.css";

/**
 * Comparison-page banner — Snippet 2 from
 * handoff/ivory-build-integration-snippets.html, ported verbatim. Sits next to
 * the Essential vs. Ivory Standard tier cards and links into the full build
 * story (/how-its-built) — the moment a homeowner is choosing a tier.
 */
export function BuildBanner() {
  return (
    <div className={styles.buildBanner}>
      <div className={styles.thumb}>
        <video autoPlay muted loop playsInline>
          <source src="/video/ivory-hero-loop.mp4" type="video/mp4" />
        </video>
      </div>
      <div className={styles.copy}>
        <div className={styles.eyebrow}>What&apos;s actually different</div>
        <h3>See what {'"'}Ivory Standard{'"'} means, step by step.</h3>
        <p>
          240+ lbs of concrete per post, a lifetime steel warranty, patented
          bracket-free rails — watch the real build, not a stock photo.
        </p>
      </div>
      <Link className={styles.cta} href="/how-its-built">
        Watch the build →
      </Link>
    </div>
  );
}

import Link from "next/link";
import styles from "./BriefingCard.module.css";

export default function BriefingCard() {
  return (
    <div className={styles.panel}>
      {/* Layer stack: bg → vignette → scrim → bloom → scan → content */}
      <div className={styles.bg} />
      <div className={styles.vignette} />
      <div className={styles.scrim} />
      <div className={styles.bloom} />
      <div className={styles.scan} />

      <span className={styles.classify}>Classified // Eyes Only</span>

      <div className={styles.content}>
        <span className={styles.eyebrow}>Mission Brief // Eyes Only</span>
        <h1 className={styles.title}>
          Build Your<br />Dream Team
        </h1>
        <p className={styles.body}>
          Your next breakthrough is one connection away. Find opportunities, join elite communities, and assemble your squad.
        </p>
        <Link href="/orgs" className={styles.cta}>
          Browse Opportunities →
        </Link>
      </div>
    </div>
  );
}

import styles from "./BriefingCard.module.css";

export default function BriefingCard() {
  return (
    <div className={styles.header}>
      <span className={styles.eyebrow}>
        <span className={styles.eyebrowLine} />
        Nivarro — Student Platform
      </span>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.sub}>Find your people. Build something real.</p>
    </div>
  );
}

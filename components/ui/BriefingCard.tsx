import styles from "./BriefingCard.module.css";

export default function BriefingCard() {
  return (
    <div className={styles.panel}>
      <div className={styles.bloom} />
      <div className={styles.scan} />
      <div className={styles.content}>
        <span className={styles.eyebrow}>
          <span className={styles.eyebrowLine} />
          Nivarro Operations
        </span>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.sub}>Mission control // Eyes only</p>
      </div>
    </div>
  );
}

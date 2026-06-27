import styles from "./BriefingCard.module.css";

export default function BriefingCard() {
  return (
    <div className={styles.panel}>
      {/* Ops-room photo — full bleed background */}
      <img src="/ops-room.png" alt="" className={styles.photo} />

      {/* Subtle amber bloom at bottom edge */}
      <div className={styles.bloom} />

      {/* Scanline texture */}
      <div className={styles.scan} />

      <div className={styles.content}>
        <span className={styles.eyebrow}>
          <span className={styles.eyebrowLine} />
          Nivarro — Student Platform
        </span>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.sub}>Find your people. Build something real.</p>
      </div>
    </div>
  );
}

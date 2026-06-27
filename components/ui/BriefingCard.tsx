import styles from "./BriefingCard.module.css";

export default function BriefingCard() {
  return (
    <div className={styles.panel}>
      {/* Real ops-room photo, fades in from right */}
      <img src="/ops-room.png" alt="" className={styles.photo} />

      {/* Left-side scrim so text stays readable */}
      <div className={styles.scrim} />

      {/* Subtle amber bloom at bottom */}
      <div className={styles.bloom} />

      {/* Scanline texture overlay */}
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

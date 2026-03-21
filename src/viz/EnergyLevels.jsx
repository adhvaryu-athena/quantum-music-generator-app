import styles from './EnergyLevels.module.css';

export default function EnergyLevels({ eigenpairs = [] }) {
  return (
    <div className={styles.panel}>
      <h3>Energy Levels</h3>
      <div className={styles.list}>
        {eigenpairs.map((pair, index) => (
          <div className={styles.row} key={`energy-${index}`}>
            <span>E{index}</span>
            <span>{pair.energy.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

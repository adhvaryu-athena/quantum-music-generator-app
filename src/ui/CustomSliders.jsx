import styles from './CustomSliders.module.css';

const sliders = [
  { key: 'width', label: 'Well Width', min: 0.7, max: 2.4, step: 0.05 },
  { key: 'barrier', label: 'Barrier Height', min: 2, max: 16, step: 0.25 },
  { key: 'depth', label: 'Well Depth', min: 2, max: 14, step: 0.25 },
];

export default function CustomSliders({ values, onChange }) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h3>Custom Potential</h3>
        <p>Resculpt the double well and re-solve the spectrum after a short debounce.</p>
      </div>
      <div className={styles.grid}>
        {sliders.map((slider) => (
          <label key={slider.key} className={styles.slider}>
            <span>{slider.label}</span>
            <strong>{values[slider.key].toFixed(2)}</strong>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={values[slider.key]}
              onChange={(event) => onChange(slider.key, Number(event.target.value))}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

import { useEffect, useRef } from 'react';
import WaveCanvas from '../viz/WaveCanvas.jsx';
import styles from './PresetCard.module.css';

const pathByPreset = {
  harmonic: 'M12 92 C32 26, 96 26, 116 92',
  square_well: 'M12 28 L12 92 L40 92 L40 54 L88 54 L88 92 L116 92 L116 28',
  double_well: 'M12 78 C30 92, 42 34, 64 62 C86 34, 98 92, 116 78',
  custom: 'M12 72 L28 72 L36 94 L48 42 L62 86 L78 30 L94 84 L116 84',
};

export default function PresetCard({ preset, onSelect, previewState }) {
  const previewRef = useRef({
    potential: previewState?.potential,
    eigenpairs: previewState?.eigenpairs,
    t: 0,
    leftProbability: previewState?.leftProbability ?? 0.5,
    rightProbability: previewState?.rightProbability ?? 0.5,
  });

  useEffect(() => {
    previewRef.current = {
      potential: previewState?.potential,
      eigenpairs: previewState?.eigenpairs,
      t: 0.8,
      leftProbability: previewState?.leftProbability ?? 0.5,
      rightProbability: previewState?.rightProbability ?? 0.5,
    };
  }, [previewState]);

  useEffect(() => {
    let frameId = 0;
    let lastTime = 0;

    const step = (timestamp) => {
      if (!lastTime) {
        lastTime = timestamp;
      }
      const delta = (timestamp - lastTime) / 1000;
      lastTime = timestamp;
      previewRef.current.t = (previewRef.current.t + delta * 0.24) % 100;
      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <button type="button" className={styles.card} onClick={() => onSelect(preset.id)}>
      <div className={styles.illustration}>
        <svg viewBox="0 0 128 100" className={styles.svg}>
          <path d={pathByPreset[preset.id]} />
          {[22, 40, 58, 76].map((y) => (
            <line key={y} x1="24" x2="104" y1={y} y2={y} />
          ))}
        </svg>
        <div className={styles.preview}>
          <WaveCanvas stateRef={previewRef} compact />
        </div>
      </div>
      <div className={styles.body}>
        <h3>{preset.name}</h3>
        <p>{preset.description}</p>
      </div>
      <div className={styles.tags}>
        {preset.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </button>
  );
}

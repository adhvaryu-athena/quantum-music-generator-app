import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Controls.module.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function VolumeKnob({ value, onChange }) {
  const knobRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) {
      return undefined;
    }

    const handleMove = (event) => {
      const rect = knobRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
      const normalized = clamp((angle + Math.PI * 0.75) / (Math.PI * 1.5), 0, 1);
      onChange(normalized);
    };

    const stop = () => setDragging(false);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stop);
    };
  }, [dragging, onChange]);

  const rotation = useMemo(() => -135 + value * 270, [value]);

  return (
    <div className={styles.knobWrap}>
      <button type="button" ref={knobRef} className={styles.knob} onPointerDown={() => setDragging(true)}>
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" className={styles.knobOuter} />
          <circle cx="50" cy="50" r="32" className={styles.knobInner} />
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="18"
            className={styles.knobNeedle}
            style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '50px 50px' }}
          />
        </svg>
      </button>
      <span>Volume</span>
    </div>
  );
}

export default function Controls({
  playing,
  onTogglePlay,
  onReset,
  t,
  onScrub,
  volume,
  onVolume,
  presets,
  activePreset,
  onPreset,
}) {
  return (
    <section className={styles.controls}>
      <div className={styles.transport}>
        <button type="button" className={styles.playButton} onClick={onTogglePlay}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onReset}>
          Reset
        </button>
      </div>

      <div className={styles.scrubberWrap}>
        <span>t = {t.toFixed(2)}</span>
        <input type="range" min="0" max="100" step="0.01" value={t} onChange={(event) => onScrub(Number(event.target.value))} />
      </div>

      <VolumeKnob value={volume} onChange={onVolume} />

      <div className={styles.tabs}>
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={preset.id === activePreset ? styles.activeTab : styles.tab}
            onClick={() => onPreset(preset.id)}
          >
            {preset.short}
          </button>
        ))}
      </div>
    </section>
  );
}

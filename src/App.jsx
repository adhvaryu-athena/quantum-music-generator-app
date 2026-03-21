import { useEffect, useMemo, useRef, useState } from 'react';
import { QuantumSynth } from './audio/QuantumSynth.js';
import { computeQuantumState } from './physics/solvePreset.js';
import { evolve, probLeft, probRight } from './physics/wavefunction.js';
import WaveCanvas from './viz/WaveCanvas.jsx';
import EnergyLevels from './viz/EnergyLevels.jsx';
import Annotations from './viz/Annotations.jsx';
import PresetCard from './ui/PresetCard.jsx';
import Controls from './ui/Controls.jsx';
import CustomSliders from './ui/CustomSliders.jsx';
import styles from './App.module.css';

const presets = [
  {
    id: 'harmonic',
    short: 'Harmonic',
    name: 'Parabolic Well',
    subtitle: 'The quantum harmonic oscillator.',
    description:
      'Parabolic Well — The quantum harmonic oscillator. Evenly spaced energy levels create a regular rhythmic pulse and stable chord voicing.',
    tags: ['EVENLY SPACED', 'STABLE'],
  },
  {
    id: 'square_well',
    short: 'Square',
    name: 'Infinite Square Well',
    subtitle: 'Hard walls, flat floor.',
    description:
      'Infinite Square Well — Hard walls, flat floor. Classic textbook problem. Energy levels grow as n², producing accelerating harmonics.',
    tags: ['HARD WALLS', 'BRIGHTER OVERTONES'],
  },
  {
    id: 'double_well',
    short: 'Double',
    name: 'Double Well',
    subtitle: 'Tunneling across a central barrier.',
    description:
      'Double Well — A W-shaped trap with a central barrier. The particle tunnels between wells, creating slow eerie beating and unusual intervals.',
    tags: ['TUNNELING', 'SLOW BEAT'],
  },
  {
    id: 'custom',
    short: 'Custom',
    name: 'Custom Potential',
    subtitle: 'Sculpt your own quantum container.',
    description:
      'Custom Potential — Sculpt your own quantum container. Adjust well width, depth, and barrier height to discover new sonic territories.',
    tags: ['ADJUSTABLE', 'EXPERIMENTAL'],
  },
];

const introLines = [
  'A quantum particle',
  'exists as a wave of possibilities.',
  'The shape of its world',
  'determines the music it makes.',
];

const defaultCustom = { width: 1.35, barrier: 8, depth: 7 };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createPanelState() {
  return {
    data: null,
    metrics: { leftProbability: 0.5, rightProbability: 0.5, beatFrequency: 0 },
    renderRef: { current: { t: 0, leftProbability: 0.5, rightProbability: 0.5, potential: null, eigenpairs: [] } },
    preview: null,
  };
}

function Mixer({ layers, onToggle, onGain }) {
  return (
    <div className={styles.mixer}>
      <h3>Layer Mixer</h3>
      {layers.map((layer, index) => (
        <div key={layer.label} className={styles.mixerRow}>
          <button type="button" className={layer.enabled ? styles.layerOn : styles.layerOff} onClick={() => onToggle(index)}>
            {layer.enabled ? 'On' : 'Off'}
          </button>
          <span>{layer.label}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={layer.gain}
            onChange={(event) => onGain(index, Number(event.target.value))}
          />
        </div>
      ))}
    </div>
  );
}

function ProbabilityBar({ leftProbability, rightProbability }) {
  return (
    <div className={styles.probabilityWrap}>
      <div className={styles.probabilityHeader}>
        <span>L</span>
        <span>{leftProbability.toFixed(3)}</span>
        <span>{rightProbability.toFixed(3)}</span>
        <span>R</span>
      </div>
      <div className={styles.probabilityBar}>
        <div className={styles.leftFill} style={{ width: `${leftProbability * 100}%` }} />
        <div className={styles.rightFill} style={{ width: `${rightProbability * 100}%` }} />
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState('intro');
  const [activePreset, setActivePreset] = useState('harmonic');
  const [secondaryPreset, setSecondaryPreset] = useState('double_well');
  const [compareMode, setCompareMode] = useState(false);
  const [customValues, setCustomValues] = useState(defaultCustom);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [timeline, setTimeline] = useState(0);
  const [loading, setLoading] = useState(false);
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [primaryState, setPrimaryState] = useState(createPanelState);
  const [secondaryState, setSecondaryState] = useState(createPanelState);
  const [layerControls, setLayerControls] = useState([
    { label: 'Base Tone', enabled: true, gain: 1 },
    { label: 'Pad Chord', enabled: true, gain: 1 },
    { label: 'Melody', enabled: true, gain: 1 },
    { label: 'Pulse', enabled: true, gain: 1 },
    { label: 'Overtones', enabled: true, gain: 1 },
  ]);

  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const rafRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const simTimeRef = useRef(0);
  const throttledUpdateRef = useRef(0);
  const synthARef = useRef(null);
  const synthBRef = useRef(null);
  const previewCacheRef = useRef({});

  const activeMeta = useMemo(() => presets.find((preset) => preset.id === activePreset), [activePreset]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase('select'), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./physics/solverWorker.js', import.meta.url), { type: 'module' });
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    synthARef.current = new QuantumSynth();
    synthBRef.current = new QuantumSynth();
    return () => {
      synthARef.current?.dispose();
      synthBRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    presets.forEach((preset) => {
      const params = preset.id === 'custom' ? customValues : {};
      previewCacheRef.current[preset.id] = computeQuantumState(preset.id, params);
    });
  }, []);

  useEffect(() => {
    if (previewCacheRef.current.custom) {
      previewCacheRef.current.custom = computeQuantumState('custom', customValues);
    }
  }, [customValues]);

  useEffect(() => {
    if (!workerRef.current) {
      return undefined;
    }

    const worker = workerRef.current;
    const handleMessage = (event) => {
      const { id, result } = event.data;
      if (id !== requestIdRef.current) {
        return;
      }
      const nextState = {
        data: result,
        preview: result,
        metrics: {
          leftProbability: result.leftProbability,
          rightProbability: result.rightProbability,
          beatFrequency: result.beatFrequency,
        },
        renderRef: {
          current: {
            t: simTimeRef.current,
            leftProbability: result.leftProbability,
            rightProbability: result.rightProbability,
            potential: result.potential,
            eigenpairs: result.eigenpairs,
          },
        },
      };
      setPrimaryState(nextState);
      synthARef.current?.init(result);
      layerControls.forEach((layer, index) => {
        synthARef.current?.setLayerEnabled(index, layer.enabled);
        synthARef.current?.setLayerGain(index, layer.gain);
      });
      synthARef.current?.setMasterVolume(volume * (compareMode ? 0.5 : 1));
      setLoading(false);
    };

    worker.addEventListener('message', handleMessage);
    return () => worker.removeEventListener('message', handleMessage);
  }, [compareMode, layerControls, volume]);

  useEffect(() => {
    const requestSolve = (preset, params) => {
      if (!workerRef.current) {
        return;
      }
      setLoading(true);
      requestIdRef.current += 1;
      workerRef.current.postMessage({ id: requestIdRef.current, preset, params });
    };

    if (phase === 'play' && activePreset !== 'custom') {
      requestSolve(activePreset, activePreset === 'custom' ? customValues : {});
    }
  }, [activePreset, customValues, phase]);

  useEffect(() => {
    if (phase !== 'play' || !compareMode) {
      setSecondaryState(createPanelState());
      synthBRef.current?.stop();
      return undefined;
    }

    const result = computeQuantumState(secondaryPreset, secondaryPreset === 'custom' ? customValues : {});
    const next = {
      data: result,
      preview: result,
      metrics: {
        leftProbability: result.leftProbability,
        rightProbability: result.rightProbability,
        beatFrequency: result.beatFrequency,
      },
      renderRef: {
        current: {
          t: simTimeRef.current,
          leftProbability: result.leftProbability,
          rightProbability: result.rightProbability,
          potential: result.potential,
          eigenpairs: result.eigenpairs,
        },
      },
    };
    setSecondaryState(next);
    synthBRef.current?.init(result);
    synthBRef.current?.setMasterVolume(volume * 0.5);
    if (playing) {
      synthBRef.current?.start();
    }
    return undefined;
  }, [compareMode, customValues, phase, playing, secondaryPreset, volume]);

  useEffect(() => {
    layerControls.forEach((layer, index) => {
      synthARef.current?.setLayerEnabled(index, layer.enabled);
      synthARef.current?.setLayerGain(index, layer.gain);
      synthBRef.current?.setLayerEnabled(index, layer.enabled);
      synthBRef.current?.setLayerGain(index, layer.gain);
    });
  }, [layerControls]);

  useEffect(() => {
    const animate = (timestamp) => {
      if (!lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
      }
      const delta = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      if (playing) {
        simTimeRef.current = (simTimeRef.current + delta * 0.3) % 100;
        if (primaryState.data) {
          const psi2 = evolve(primaryState.data.eigenpairs, simTimeRef.current);
          const left = probLeft(psi2);
          const right = probRight(psi2);
          primaryState.renderRef.current = {
            t: simTimeRef.current,
            leftProbability: left,
            rightProbability: right,
            potential: primaryState.data.potential,
            eigenpairs: primaryState.data.eigenpairs,
          };
          synthARef.current?.tick(simTimeRef.current);
          if (timestamp - throttledUpdateRef.current > 100) {
            throttledUpdateRef.current = timestamp;
            setTimeline(simTimeRef.current);
            setPrimaryState((previous) => ({
              ...previous,
              metrics: { ...previous.metrics, leftProbability: left, rightProbability: right },
            }));
          }
        }

        if (compareMode && secondaryState.data) {
          const psi2 = evolve(secondaryState.data.eigenpairs, simTimeRef.current);
          const left = probLeft(psi2);
          const right = probRight(psi2);
          secondaryState.renderRef.current = {
            t: simTimeRef.current,
            leftProbability: left,
            rightProbability: right,
            potential: secondaryState.data.potential,
            eigenpairs: secondaryState.data.eigenpairs,
          };
          synthBRef.current?.tick(simTimeRef.current);
          if (timestamp - throttledUpdateRef.current > 100) {
            setSecondaryState((previous) => ({
              ...previous,
              metrics: { ...previous.metrics, leftProbability: left, rightProbability: right },
            }));
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [compareMode, playing, primaryState, secondaryState]);

  useEffect(() => {
    if (compareMode) {
      synthARef.current?.setMasterVolume(volume * 0.5);
      synthBRef.current?.setMasterVolume(volume * 0.5);
    } else {
      synthARef.current?.setMasterVolume(volume);
      synthBRef.current?.setMasterVolume(0);
    }
  }, [compareMode, volume]);

  useEffect(() => {
    if (phase !== 'play' || activePreset !== 'custom') {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      requestIdRef.current += 1;
      workerRef.current?.postMessage({ id: requestIdRef.current, preset: 'custom', params: customValues });
      setLoading(true);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [activePreset, customValues, phase]);

  const selectPreset = (presetId) => {
    setActivePreset(presetId);
    setPhase('play');
    simTimeRef.current = 0;
    setTimeline(0);
  };

  const togglePlay = async () => {
    if (!primaryState.data) {
      return;
    }
    if (playing) {
      synthARef.current?.stop();
      synthBRef.current?.stop();
      setPlaying(false);
      return;
    }
    await synthARef.current?.start();
    if (compareMode && secondaryState.data) {
      await synthBRef.current?.start();
    }
    setPlaying(true);
  };

  const resetTime = () => {
    simTimeRef.current = 0;
    setTimeline(0);
  };

  const scrubTime = (value) => {
    simTimeRef.current = value;
    setTimeline(value);
  };

  const updateCustom = (key, value) => {
    setCustomValues((previous) => ({ ...previous, [key]: value }));
  };

  const toggleLayer = (index) => {
    setLayerControls((previous) => previous.map((layer, layerIndex) => (layerIndex === index ? { ...layer, enabled: !layer.enabled } : layer)));
  };

  const updateLayerGain = (index, gain) => {
    setLayerControls((previous) => previous.map((layer, layerIndex) => (layerIndex === index ? { ...layer, gain } : layer)));
  };

  return (
    <div className={styles.appShell}>
      <div className={styles.backgroundNoise} />
      <div className={styles.gridOverlay} />

      {phase === 'intro' && (
        <section className={styles.intro} onClick={() => setPhase('select')}>
          {introLines.map((line, index) => (
            <p key={line} style={{ animationDelay: `${index * 0.55}s` }}>
              {line}
            </p>
          ))}
        </section>
      )}

      {phase === 'select' && (
        <section className={styles.selection}>
          <div className={styles.selectionHeader}>
            <span>Choose your quantum container</span>
            <h1>CHOOSE YOUR QUANTUM CONTAINER</h1>
          </div>
          <div className={styles.cardGrid}>
            {presets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} onSelect={selectPreset} previewState={previewCacheRef.current[preset.id]} />
            ))}
          </div>
        </section>
      )}

      {phase === 'play' && (
        <section className={styles.playPhase}>
          <header className={styles.topBar}>
            <button type="button" className={styles.backButton} onClick={() => setPhase('select')}>
              ← Back
            </button>
            <div>
              <span className={styles.kicker}>{activeMeta.subtitle}</span>
              <h1>{activeMeta.name}</h1>
            </div>
            <button type="button" className={styles.compareButton} onClick={() => setCompareMode((value) => !value)}>
              {compareMode ? 'Single' : 'Compare'}
            </button>
          </header>

          <div className={compareMode ? styles.compareLayout : styles.mainLayout}>
            <div className={styles.stageColumn}>
              <div className={compareMode ? styles.compareCanvasWrap : styles.canvasWrap}>
                <div className={styles.canvasPanel}>
                  <WaveCanvas stateRef={primaryState.renderRef} />
                  <div className={styles.canvasLabel}>{activeMeta.name}</div>
                </div>
                {compareMode && (
                  <div className={styles.canvasPanel}>
                    <WaveCanvas stateRef={secondaryState.renderRef} />
                    <div className={styles.canvasLabel}>{presets.find((preset) => preset.id === secondaryPreset)?.name}</div>
                  </div>
                )}
              </div>

              <Annotations
                leftProbability={primaryState.metrics.leftProbability}
                rightProbability={primaryState.metrics.rightProbability}
                beatFrequency={primaryState.metrics.beatFrequency}
              />

              <Controls
                playing={playing}
                onTogglePlay={togglePlay}
                onReset={resetTime}
                t={timeline}
                onScrub={scrubTime}
                volume={volume}
                onVolume={setVolume}
                presets={presets}
                activePreset={activePreset}
                onPreset={setActivePreset}
              />

              {activePreset === 'custom' && <CustomSliders values={customValues} onChange={updateCustom} />}
              {compareMode && (
                <div className={styles.secondaryTabs}>
                  <span>Comparison Target</span>
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={preset.id === secondaryPreset ? styles.activeCompareTab : styles.compareTab}
                      onClick={() => setSecondaryPreset(preset.id)}
                    >
                      {preset.short}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <aside className={infoCollapsed ? styles.sideCollapsed : styles.sidePanel}>
              <button type="button" className={styles.collapseButton} onClick={() => setInfoCollapsed((value) => !value)}>
                {infoCollapsed ? 'Open' : 'Close'}
              </button>
              {!infoCollapsed && (
                <>
                  {loading && <div className={styles.loading}>Solving tridiagonal Hamiltonian…</div>}
                  <EnergyLevels eigenpairs={primaryState.data?.eigenpairs ?? []} />
                  <ProbabilityBar
                    leftProbability={primaryState.metrics.leftProbability}
                    rightProbability={primaryState.metrics.rightProbability}
                  />
                  <div className={styles.metricCard}>
                    <span>Beating Frequency</span>
                    <strong>{primaryState.metrics.beatFrequency.toFixed(3)} Hz</strong>
                  </div>
                  <Mixer layers={layerControls} onToggle={toggleLayer} onGain={updateLayerGain} />
                </>
              )}
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}

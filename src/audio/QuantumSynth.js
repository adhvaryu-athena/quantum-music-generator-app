import { buildScaleArray, snapToScale } from './scales.js';
import { beatingFreq, evolve, probLeft, probRight, superpositionCoefficients } from '../physics/wavefunction.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const createImpulseResponse = (context, duration = 2.8, decay = 2.2) => {
  const length = Math.floor(context.sampleRate * duration);
  const impulse = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const envelope = (1 - i / length) ** decay;
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
  }

  return impulse;
};

export class QuantumSynth {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.layers = [];
    this.initialized = false;
    this.running = false;
    this.currentState = null;
    this.lastMelodyTime = 0;
    this.lastPulseTime = 0;
    this.outputVolume = 0.7;
    this.scale = buildScaleArray(110, 3);
    this.layerSettings = Array.from({ length: 5 }, () => ({ enabled: true, gain: 1 }));
  }

  ensureContext() {
    if (this.context) {
      return this.context;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContextClass();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.0001;
    this.masterGain.connect(this.context.destination);
    this.buildGraph();
    return this.context;
  }

  buildGraph() {
    const context = this.context;
    const now = context.currentTime;

    this.layers = [];

    const baseOutput = context.createGain();
    const baseMix = context.createGain();
    const baseFilter = context.createBiquadFilter();
    const panner = context.createStereoPanner();
    baseOutput.gain.value = 0;
    baseFilter.type = 'lowpass';
    baseFilter.frequency.value = 800;
    baseMix.connect(baseFilter).connect(panner).connect(baseOutput).connect(this.masterGain);
    const baseOscillators = [-2, 0, 2].map((detune) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.value = 110;
      osc.detune.value = detune;
      gain.gain.value = 0.14;
      osc.connect(gain).connect(baseMix);
      osc.start(now);
      return { osc, gain };
    });
    this.layers.push({
      gainNode: baseOutput,
      setGain: (value, atTime = context.currentTime) => baseOutput.gain.setTargetAtTime(value, atTime, 0.08),
      panner,
      oscillators: baseOscillators,
    });

    const padOutput = context.createGain();
    const dryPad = context.createGain();
    const wetPad = context.createGain();
    const convolver = context.createConvolver();
    convolver.buffer = createImpulseResponse(context);
    padOutput.gain.value = 0;
    dryPad.gain.value = 0.08;
    wetPad.gain.value = 0.22;
    dryPad.connect(padOutput);
    wetPad.connect(convolver).connect(padOutput);
    padOutput.connect(this.masterGain);
    const padOscillators = [0, 1, 2].map((index) => {
      const sine = context.createOscillator();
      const triangle = context.createOscillator();
      const sineGain = context.createGain();
      const triangleGain = context.createGain();
      sine.type = 'sine';
      triangle.type = 'triangle';
      sineGain.gain.value = 0.05;
      triangleGain.gain.value = 0.025;
      sine.connect(sineGain).connect(dryPad);
      sine.connect(sineGain).connect(wetPad);
      triangle.connect(triangleGain).connect(dryPad);
      triangle.connect(triangleGain).connect(wetPad);
      sine.start(now);
      triangle.start(now);
      return { sine, triangle };
    });
    this.layers.push({
      gainNode: padOutput,
      setGain: (value, atTime = context.currentTime) => padOutput.gain.setTargetAtTime(value, atTime, 0.12),
      oscillators: padOscillators,
    });

    const melodyOutput = context.createGain();
    const melodyOsc = context.createOscillator();
    const melodyGain = context.createGain();
    melodyOutput.gain.value = 0;
    melodyOsc.type = 'triangle';
    melodyOsc.frequency.value = 220;
    melodyGain.gain.value = 0;
    melodyOsc.connect(melodyGain).connect(melodyOutput).connect(this.masterGain);
    melodyOsc.start(now);
    this.layers.push({
      gainNode: melodyOutput,
      setGain: (value, atTime = context.currentTime) => melodyOutput.gain.setTargetAtTime(value, atTime, 0.08),
      oscillator: melodyOsc,
      envelope: melodyGain,
    });

    const pulseOutput = context.createGain();
    const pulseOsc = context.createOscillator();
    const pulseGain = context.createGain();
    pulseOutput.gain.value = 0;
    pulseOsc.type = 'sine';
    pulseOsc.frequency.value = 60;
    pulseGain.gain.value = 0;
    pulseOsc.connect(pulseGain).connect(pulseOutput).connect(this.masterGain);
    pulseOsc.start(now);
    this.layers.push({
      gainNode: pulseOutput,
      setGain: (value, atTime = context.currentTime) => pulseOutput.gain.setTargetAtTime(value, atTime, 0.08),
      oscillator: pulseOsc,
      envelope: pulseGain,
    });

    const overtoneOutput = context.createGain();
    overtoneOutput.gain.value = 0;
    overtoneOutput.connect(this.masterGain);
    const overtoneOscillators = Array.from({ length: 4 }, () => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      gain.gain.value = 0.025;
      osc.connect(gain).connect(overtoneOutput);
      osc.start(now);
      return { osc, gain };
    });
    this.layers.push({
      gainNode: overtoneOutput,
      setGain: (value, atTime = context.currentTime) => overtoneOutput.gain.setTargetAtTime(value, atTime, 0.08),
      oscillators: overtoneOscillators,
    });

    this.applyLayerSettings();
  }

  applyLayerSettings() {
    this.layers.forEach((layer, index) => {
      const setting = this.layerSettings[index];
      if (!layer || !setting) {
        return;
      }
      const baseGains = [0.72, 0.3, 0.45, 0.4, 0.2];
      const target = setting.enabled ? baseGains[index] * setting.gain : 0;
      layer.setGain(target, this.context?.currentTime ?? 0);
    });
  }

  setMasterVolume(value) {
    if (!this.context || !this.masterGain) {
      this.outputVolume = clamp(value, 0, 1);
      return;
    }
    this.outputVolume = clamp(value, 0, 1);
    this.masterGain.gain.setTargetAtTime(this.outputVolume * 0.9, this.context.currentTime, 0.08);
  }

  setLayerEnabled(index, enabled) {
    this.layerSettings[index].enabled = enabled;
    this.applyLayerSettings();
  }

  setLayerGain(index, gain) {
    this.layerSettings[index].gain = clamp(gain, 0, 1);
    this.applyLayerSettings();
  }

  init(quantumState) {
    this.ensureContext();
    this.currentState = quantumState;
    this.scale = buildScaleArray(110, 3);
    this.configureFromState(quantumState);
    this.initialized = true;
    this.lastMelodyTime = 0;
    this.lastPulseTime = 0;
  }

  configureFromState({ eigenpairs }) {
    const context = this.context;
    if (!context || !eigenpairs?.length) {
      return;
    }

    const now = context.currentTime;
    const baseLayer = this.layers[0];
    baseLayer.oscillators.forEach(({ osc }) => {
      osc.frequency.setTargetAtTime(110, now, 0.1);
    });

    const padLayer = this.layers[1];
    const baseEnergy = Math.max(eigenpairs[0].energy, 1e-6);
    const padFrequencies = [1, 2, 3].map((index) => {
      const ratio = snapToScale(eigenpairs[index].energy / baseEnergy);
      return 110 * ratio;
    });
    padLayer.oscillators.forEach(({ sine, triangle }, index) => {
      const frequency = padFrequencies[index] ?? 220;
      sine.frequency.setTargetAtTime(frequency, now, 0.2);
      triangle.frequency.setTargetAtTime(frequency * 0.5, now, 0.2);
    });

    const overtoneLayer = this.layers[4];
    const maxEnergy = eigenpairs[eigenpairs.length - 1].energy;
    overtoneLayer.oscillators.forEach(({ osc, gain }, index) => {
      const pair = eigenpairs[index];
      const frequency = 200 + (pair.energy / maxEnergy) * 600;
      osc.frequency.setTargetAtTime(frequency, now, 0.15);
      gain.gain.setTargetAtTime(0.05 * superpositionCoefficients[index], now, 0.1);
    });

    const pulseLayer = this.layers[3];
    pulseLayer.oscillator.frequency.setTargetAtTime(60, now, 0.05);
  }

  async start() {
    const context = this.ensureContext();
    if (context.state === 'suspended') {
      await context.resume();
    }
    this.running = true;
    this.applyLayerSettings();
  }

  stop() {
    if (!this.context) {
      return;
    }
    const now = this.context.currentTime;
    this.running = false;
    this.layers[2]?.envelope.gain.cancelScheduledValues(now);
    this.layers[2]?.envelope.gain.setTargetAtTime(0, now, 0.08);
    this.layers[3]?.envelope.gain.cancelScheduledValues(now);
    this.layers[3]?.envelope.gain.setTargetAtTime(0, now, 0.08);
    this.masterGain.gain.setTargetAtTime(0.0001, now, 0.12);
  }

  tick(t) {
    if (!this.context || !this.currentState || !this.running) {
      return;
    }

    const contextTime = this.context.currentTime;
    const psi2 = evolve(this.currentState.eigenpairs, t, 1);
    const left = probLeft(psi2);
    const right = probRight(psi2);
    const delta = clamp(right - left, -1, 1);

    this.masterGain.gain.setTargetAtTime(this.outputVolume * 0.9, contextTime, 0.12);
    this.layers[0].panner.pan.setTargetAtTime(delta, contextTime, 0.08);

    const melodyInterval = 60 / 90 / 2;
    if (contextTime - this.lastMelodyTime >= melodyInterval) {
      const balance = clamp(left - right, -1, 1);
      const index = Math.round(((balance + 1) / 2) * (this.scale.length - 1));
      const frequency = this.scale[clamp(index, 0, this.scale.length - 1)];
      const envelope = this.layers[2].envelope.gain;
      const oscillator = this.layers[2].oscillator.frequency;
      envelope.cancelScheduledValues(contextTime);
      envelope.setValueAtTime(0, contextTime);
      envelope.linearRampToValueAtTime(0.38, contextTime + 0.02);
      envelope.linearRampToValueAtTime(0.24, contextTime + 0.17);
      envelope.setTargetAtTime(0.24, contextTime + 0.17, 0.05);
      envelope.setTargetAtTime(0, contextTime + 0.38, 0.08);
      oscillator.setTargetAtTime(frequency, contextTime, 0.02);
      this.lastMelodyTime = contextTime;
    }

    const beat = clamp(beatingFreq(this.currentState.eigenpairs), 0.5, 4);
    const pulseInterval = 1 / beat;
    if (contextTime - this.lastPulseTime >= pulseInterval) {
      const envelope = this.layers[3].envelope.gain;
      envelope.cancelScheduledValues(contextTime);
      envelope.setValueAtTime(0, contextTime);
      envelope.linearRampToValueAtTime(0.4, contextTime + 0.01);
      envelope.exponentialRampToValueAtTime(0.001, contextTime + 0.08);
      this.lastPulseTime = contextTime;
    }
  }

  dispose() {
    if (!this.context) {
      return;
    }
    this.running = false;
    this.context.close();
    this.context = null;
    this.masterGain = null;
    this.layers = [];
  }
}

import { computeQuantumState } from './solvePreset.js';

self.onmessage = (event) => {
  const { id, preset, params } = event.data;
  const startedAt = performance.now();
  const result = computeQuantumState(preset, params);
  self.postMessage({
    id,
    result,
    duration: performance.now() - startedAt,
  });
};

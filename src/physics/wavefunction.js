import { dx, N, x } from './grid.js';

const rawCoefficients = [1.0, 0.7, 0.4, 0.2, 0.1];
const coefficientNorm = Math.sqrt(rawCoefficients.reduce((sum, value) => sum + value * value, 0));
export const superpositionCoefficients = rawCoefficients.map((value) => value / coefficientNorm);

export const evolve = (eigenpairs, t, energyScale = 1) => {
  const real = new Float64Array(N);
  const imag = new Float64Array(N);
  const probability = new Float64Array(N);

  for (let n = 0; n < Math.min(superpositionCoefficients.length, eigenpairs.length); n += 1) {
    const coeff = superpositionCoefficients[n];
    const phase = -eigenpairs[n].energy * t * energyScale;
    const cosPhase = Math.cos(phase);
    const sinPhase = Math.sin(phase);
    const vector = eigenpairs[n].vector;

    for (let i = 0; i < N; i += 1) {
      const amplitude = coeff * vector[i];
      real[i] += amplitude * cosPhase;
      imag[i] += amplitude * sinPhase;
    }
  }

  let total = 0;
  for (let i = 0; i < N; i += 1) {
    const value = real[i] * real[i] + imag[i] * imag[i];
    probability[i] = value;
    total += value;
  }

  const scale = 1 / (total * dx);
  for (let i = 0; i < N; i += 1) {
    probability[i] *= scale;
  }

  return probability;
};

export const probLeft = (psi2) => {
  let sum = 0;
  for (let i = 0; i < N; i += 1) {
    if (x[i] < 0) {
      sum += psi2[i];
    }
  }
  return sum * dx;
};

export const probRight = (psi2) => {
  let sum = 0;
  for (let i = 0; i < N; i += 1) {
    if (x[i] >= 0) {
      sum += psi2[i];
    }
  }
  return sum * dx;
};

export const beatingFreq = (eigenpairs) => {
  if (eigenpairs.length < 2) {
    return 0;
  }
  return Math.max(0, eigenpairs[1].energy - eigenpairs[0].energy);
};

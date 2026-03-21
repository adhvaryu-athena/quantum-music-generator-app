import { buildHamiltonian } from './hamiltonian.js';
import { buildPotential } from './potentials.js';
import { solveEigen } from './eigensolver.js';
import { beatingFreq, evolve, probLeft, probRight } from './wavefunction.js';

export const computeQuantumState = (preset, params = {}) => {
  const potential = buildPotential(preset, params);
  const hamiltonian = buildHamiltonian(potential);
  const eigenpairs = solveEigen(hamiltonian, 5);
  const psi2 = evolve(eigenpairs, 0);
  const leftProbability = probLeft(psi2);
  const rightProbability = probRight(psi2);

  return {
    preset,
    params,
    potential,
    eigenpairs,
    psi2,
    leftProbability,
    rightProbability,
    beatFrequency: beatingFreq(eigenpairs),
  };
};

import { buildHamiltonian } from '../src/physics/hamiltonian.js';
import { harmonic, square_well, double_well, custom } from '../src/physics/potentials.js';
import { solveEigen } from '../src/physics/eigensolver.js';
import { dx } from '../src/physics/grid.js';
import { evolve, probLeft, probRight } from '../src/physics/wavefunction.js';

const presets = {
  harmonic: harmonic(),
  square_well: square_well(),
  double_well: double_well(),
  custom: custom(),
};

const approx = (value, target, tolerance) => Math.abs(value - target) / target <= tolerance;

for (const [name, potential] of Object.entries(presets)) {
  const eigenpairs = solveEigen(buildHamiltonian(potential), 5);
  const energies = eigenpairs.map((pair) => pair.energy);
  console.log(`\n${name}`);
  console.log(energies.map((value, index) => `E${index}=${value.toFixed(6)}`).join('  '));

  const positive = energies.every((value) => value > -20);
  const increasing = energies.every((value, index) => index === 0 || value > energies[index - 1]);
  console.log(`positive=${positive} increasing=${increasing}`);

  const normChecks = eigenpairs.map(({ vector }) => vector.reduce((sum, value) => sum + value * value, 0) * dx);
  console.log(`norms=${normChecks.map((value) => value.toFixed(6)).join(', ')}`);

  const psi2 = evolve(eigenpairs, 2.4);
  const norm = psi2.reduce((sum, value) => sum + value, 0) * dx;
  const left = probLeft(psi2);
  const right = probRight(psi2);
  console.log(`psi_norm=${norm.toFixed(6)} L+R=${(left + right).toFixed(6)}`);

  if (name === 'harmonic') {
    console.log(
      `harmonic checks: ${approx(energies[0], 0.5, 0.05)} ${approx(energies[1], 1.5, 0.05)} ${approx(energies[2], 2.5, 0.05)}`,
    );
  }

  if (name === 'square_well') {
    console.log(
      `square checks: ${approx(energies[0], 0.137, 0.1)} ${approx(energies[1], 0.548, 0.1)} ${approx(energies[2], 1.233, 0.1)}`,
    );
  }
}

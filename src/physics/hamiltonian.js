import { N, dx } from './grid.js';

export const buildHamiltonian = (potential) => {
  const diag = new Float64Array(N);
  const upper = new Float64Array(N - 1);
  const lower = new Float64Array(N - 1);
  const kineticDiag = 1 / (dx * dx);
  const kineticOffDiag = -0.5 / (dx * dx);

  for (let i = 0; i < N; i += 1) {
    diag[i] = kineticDiag + potential[i];
    if (i < N - 1) {
      upper[i] = kineticOffDiag;
      lower[i] = kineticOffDiag;
    }
  }

  return { diag, upper, lower };
};

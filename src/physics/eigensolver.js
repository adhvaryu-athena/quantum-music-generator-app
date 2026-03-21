import { dx, N } from './grid.js';

const dot = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum * dx;
};

const norm = (vector) => Math.sqrt(Math.max(dot(vector, vector), 1e-30));

const normalize = (vector) => {
  const magnitude = norm(vector);
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] /= magnitude;
  }
  return vector;
};

const modifiedGramSchmidt = (vector, basis) => {
  for (let pass = 0; pass < 2; pass += 1) {
    for (let k = 0; k < basis.length; k += 1) {
      const projection = dot(vector, basis[k]);
      for (let i = 0; i < vector.length; i += 1) {
        vector[i] -= projection * basis[k][i];
      }
    }
  }
  return normalize(vector);
};

const tridiagonalMatVec = ({ diag, upper, lower }, vector, out) => {
  if (N === 1) {
    out[0] = diag[0] * vector[0];
    return out;
  }

  out[0] = diag[0] * vector[0] + upper[0] * vector[1];
  for (let i = 1; i < N - 1; i += 1) {
    out[i] = lower[i - 1] * vector[i - 1] + diag[i] * vector[i] + upper[i] * vector[i + 1];
  }
  out[N - 1] = lower[N - 2] * vector[N - 2] + diag[N - 1] * vector[N - 1];
  return out;
};

const rayleighQuotient = (hamiltonian, vector, workspace) => {
  tridiagonalMatVec(hamiltonian, vector, workspace);
  return dot(vector, workspace);
};

const factorShifted = ({ diag, upper, lower }, shift) => {
  const cPrime = new Float64Array(N - 1);
  const denom = new Float64Array(N);
  const epsilon = 1e-14;

  denom[0] = diag[0] - shift;
  if (Math.abs(denom[0]) < epsilon) {
    denom[0] = Math.sign(denom[0] || 1) * epsilon;
  }
  if (N > 1) {
    cPrime[0] = upper[0] / denom[0];
  }

  for (let i = 1; i < N - 1; i += 1) {
    denom[i] = diag[i] - shift - lower[i - 1] * cPrime[i - 1];
    if (Math.abs(denom[i]) < epsilon) {
      denom[i] = Math.sign(denom[i] || 1) * epsilon;
    }
    cPrime[i] = upper[i] / denom[i];
  }

  if (N > 1) {
    denom[N - 1] = diag[N - 1] - shift - lower[N - 2] * cPrime[N - 2];
    if (Math.abs(denom[N - 1]) < epsilon) {
      denom[N - 1] = Math.sign(denom[N - 1] || 1) * epsilon;
    }
  }

  return { cPrime, denom };
};

const solveFactored = ({ lower }, factors, rhs, out) => {
  const { cPrime, denom } = factors;
  const dPrime = new Float64Array(N);

  dPrime[0] = rhs[0] / denom[0];
  for (let i = 1; i < N; i += 1) {
    dPrime[i] = (rhs[i] - lower[i - 1] * dPrime[i - 1]) / denom[i];
  }

  out[N - 1] = dPrime[N - 1];
  for (let i = N - 2; i >= 0; i -= 1) {
    out[i] = dPrime[i] - cPrime[i] * out[i + 1];
  }
  return out;
};

const sturmCount = ({ diag, lower }, lambda) => {
  let count = 0;
  let pivot = diag[0] - lambda;
  const epsilon = 1e-14;

  if (pivot < 0) {
    count += 1;
  }
  if (Math.abs(pivot) < epsilon) {
    pivot = -epsilon;
  }

  for (let i = 1; i < N; i += 1) {
    pivot = diag[i] - lambda - (lower[i - 1] * lower[i - 1]) / pivot;
    if (pivot < 0) {
      count += 1;
    }
    if (Math.abs(pivot) < epsilon) {
      pivot = pivot < 0 ? -epsilon : epsilon;
    }
  }

  return count;
};

const gershgorinBounds = ({ diag, upper, lower }) => {
  let lowerBound = Number.POSITIVE_INFINITY;
  let upperBound = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < N; i += 1) {
    const radius = Math.abs(lower[i - 1] ?? 0) + Math.abs(upper[i] ?? 0);
    lowerBound = Math.min(lowerBound, diag[i] - radius);
    upperBound = Math.max(upperBound, diag[i] + radius);
  }

  return { lowerBound, upperBound };
};

const bisectEigenvalue = (hamiltonian, index, tolerance) => {
  const { lowerBound, upperBound } = gershgorinBounds(hamiltonian);
  let left = lowerBound;
  let right = upperBound;

  for (let iteration = 0; iteration < 120; iteration += 1) {
    const middle = 0.5 * (left + right);
    const count = sturmCount(hamiltonian, middle);
    if (count <= index) {
      left = middle;
    } else {
      right = middle;
    }
    if (Math.abs(right - left) < tolerance) {
      break;
    }
  }

  return 0.5 * (left + right);
};

const seedVector = (index) => {
  const vector = new Float64Array(N);
  for (let i = 0; i < N; i += 1) {
    const phase = ((index + 1) * Math.PI * (i + 0.5)) / N;
    vector[i] = Math.sin(phase) + 0.25 * Math.sin(0.31 * phase + index * 0.7);
  }
  return normalize(vector);
};

export const solveEigen = (hamiltonian, K = 5, options = {}) => {
  const tolerance = options.tolerance ?? 1e-10;
  const maxIterations = options.maxIterations ?? 500;
  const workspace = new Float64Array(N);
  const basis = [];
  const eigenpairs = [];

  for (let k = 0; k < K; k += 1) {
    const eigenvalue = bisectEigenvalue(hamiltonian, k, tolerance);
    const shift = eigenvalue + 1e-9 * (k + 1);
    const factors = factorShifted(hamiltonian, shift);
    let vector = modifiedGramSchmidt(seedVector(k), basis);
    let previousEnergy = Number.POSITIVE_INFINITY;

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const candidate = solveFactored(hamiltonian, factors, vector, new Float64Array(N));
      vector = modifiedGramSchmidt(candidate, basis);
      const energy = rayleighQuotient(hamiltonian, vector, workspace);
      const relativeChange = Math.abs(energy - previousEnergy) / Math.max(1, Math.abs(energy));
      previousEnergy = energy;
      if (relativeChange < 1e-8) {
        break;
      }
    }

    const energy = rayleighQuotient(hamiltonian, vector, workspace);
    basis.push(vector.slice());
    eigenpairs.push({ energy, vector: vector.slice() });
  }

  return eigenpairs.sort((a, b) => a.energy - b.energy);
};

import { N, x } from './grid.js';

const fillPotential = (fn) => {
  const values = new Float64Array(N);
  for (let i = 0; i < N; i += 1) {
    values[i] = fn(x[i], i);
  }
  return values;
};

export const harmonic = () => fillPotential((position) => 0.5 * position * position);

export const square_well = () => fillPotential((position) => (Math.abs(position) < 3 ? 0 : 50));

export const double_well = () => fillPotential((position) => 0.1 * (position * position - 4) ** 2);

export const custom = (_, params = {}) => {
  const {
    width = 1.35,
    depth = 7,
    barrier = 8,
    barrierWidth = 0.55,
  } = params;
  const halfBarrier = Math.max(0.1, barrierWidth) / 2;
  const wellHalfWidth = Math.max(0.2, width) / 2;
  const centerOffset = Math.max(0.6, width);
  return fillPotential((position) => {
    const leftCenter = -centerOffset;
    const rightCenter = centerOffset;
    const inLeftWell = Math.abs(position - leftCenter) <= wellHalfWidth;
    const inRightWell = Math.abs(position - rightCenter) <= wellHalfWidth;
    const inBarrier = Math.abs(position) <= halfBarrier;

    let value = 18;
    if (inLeftWell || inRightWell) {
      value = -Math.max(1, depth);
    }
    if (inBarrier) {
      value = Math.max(value, barrier);
    }

    const edgeLift = 0.18 * position * position;
    return value + edgeLift;
  });
};

export const potentialFactories = {
  harmonic,
  square_well,
  double_well,
  custom,
};

export const buildPotential = (preset, params) => {
  const factory = potentialFactories[preset] ?? harmonic;
  return factory(x, params);
};

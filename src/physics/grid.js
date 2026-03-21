export const N = 801;
export const L = 10;
export const dx = L / (N - 1);

export const x = new Float64Array(N);
for (let i = 0; i < N; i += 1) {
  x[i] = -L / 2 + i * dx;
}

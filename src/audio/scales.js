const AEOLIAN_INTERVALS = [0, 2, 3, 5, 7, 8, 10, 12];

export const aeolianSemitones = AEOLIAN_INTERVALS;

export const snapToScale = (freqRatio) => {
  const octaveShift = Math.floor(Math.log2(Math.max(freqRatio, 1e-6)));
  const normalized = freqRatio / 2 ** octaveShift;

  let nearestRatio = 1;
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const interval of AEOLIAN_INTERVALS) {
    const ratio = 2 ** (interval / 12);
    const distance = Math.abs(normalized - ratio);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearestRatio = ratio;
    }
  }

  return nearestRatio * 2 ** octaveShift;
};

export const buildScaleArray = (rootHz, octaves = 2) => {
  const frequencies = [];
  for (let octave = 0; octave < octaves; octave += 1) {
    for (let i = 0; i < AEOLIAN_INTERVALS.length; i += 1) {
      const semitone = AEOLIAN_INTERVALS[i] + octave * 12;
      frequencies.push(rootHz * 2 ** (semitone / 12));
    }
  }
  return frequencies;
};

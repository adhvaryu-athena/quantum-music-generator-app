import { useEffect, useRef } from 'react';
import { L, x } from '../physics/grid.js';
import { evolve } from '../physics/wavefunction.js';
import styles from './WaveCanvas.module.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const drawSmoothPath = (ctx, points, fillBaseY) => {
  const lastPoint = points[points.length - 1];
  ctx.beginPath();
  ctx.moveTo(points[0].x, fillBaseY);
  ctx.lineTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i += 1) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  ctx.lineTo(lastPoint.x, lastPoint.y);
  ctx.lineTo(lastPoint.x, fillBaseY);
  ctx.closePath();
};

export default function WaveCanvas({ stateRef, compact = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext('2d');
    let frameId = 0;

    const render = () => {
      const state = stateRef.current;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#05070f');
      gradient.addColorStop(1, '#0d1117');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      if (state?.potential && state.eigenpairs?.length) {
        const potentialTop = compact ? height * 0.84 : height * 0.86;
        const waveBase = compact ? height * 0.76 : height * 0.72;
        const maxPotential = Math.max(...state.potential);
        const maxEnergy = Math.max(state.eigenpairs[4]?.energy ?? 1, state.eigenpairs[0].energy);
        const psi2 = evolve(state.eigenpairs, state.t);
        const leftColor = `hsla(220, 90%, 65%, ${0.35 + state.leftProbability * 0.65})`;
        const rightColor = `hsla(35, 90%, 65%, ${0.35 + state.rightProbability * 0.65})`;
        const dominantColor = state.leftProbability >= state.rightProbability ? '#79a5ff' : '#ffc067';

        context.beginPath();
        context.moveTo(0, height);
        for (let i = 0; i < x.length; i += 1) {
          const px = (i / (x.length - 1)) * width;
          const potential = clamp(state.potential[i], -12, maxPotential);
          const py = potentialTop - (potential / maxPotential) * height * 0.22;
          context.lineTo(px, py);
        }
        context.lineTo(width, height);
        context.closePath();
        context.fillStyle = 'rgba(26, 58, 74, 0.82)';
        context.fill();
        context.strokeStyle = 'rgba(74, 243, 200, 0.55)';
        context.lineWidth = compact ? 1.2 : 1.6;
        context.shadowBlur = compact ? 6 : 14;
        context.shadowColor = '#4af3c8';
        context.stroke();
        context.shadowBlur = 0;

        context.setLineDash([6, 6]);
        context.strokeStyle = 'rgba(100, 200, 255, 0.4)';
        context.fillStyle = 'rgba(200, 216, 232, 0.8)';
        context.font = compact ? '10px "Space Mono", monospace' : '12px "Space Mono", monospace';
        state.eigenpairs.forEach((pair, index) => {
          const y = waveBase - (pair.energy / maxEnergy) * height * 0.34;
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(width, y);
          context.stroke();
          if (!compact) {
            context.textAlign = 'right';
            context.fillText(`E${index}`, width - 14, y - 6);
          }
        });
        context.setLineDash([]);

        const maxPsi = Math.max(...psi2);
        const wavePoints = [];
        for (let i = 0; i < psi2.length; i += 1) {
          const px = (i / (psi2.length - 1)) * width;
          const py = waveBase - (psi2[i] / maxPsi) * height * (compact ? 0.3 : 0.38);
          wavePoints.push({ x: px, y: py });
        }

        const waveGradient = context.createLinearGradient(0, 0, width, 0);
        waveGradient.addColorStop(0, leftColor);
        waveGradient.addColorStop(1, rightColor);
        context.shadowBlur = compact ? 10 : 20;
        context.shadowColor = dominantColor;
        drawSmoothPath(context, wavePoints, waveBase);
        context.fillStyle = waveGradient;
        context.fill();
        context.strokeStyle = 'rgba(220, 240, 255, 0.95)';
        context.lineWidth = compact ? 1.2 : 2;
        context.beginPath();
        context.moveTo(wavePoints[0].x, wavePoints[0].y);
        for (let i = 1; i < wavePoints.length - 1; i += 1) {
          const xc = (wavePoints[i].x + wavePoints[i + 1].x) / 2;
          const yc = (wavePoints[i].y + wavePoints[i + 1].y) / 2;
          context.quadraticCurveTo(wavePoints[i].x, wavePoints[i].y, xc, yc);
        }
        context.stroke();
        context.shadowBlur = 0;

        context.fillStyle = `rgba(121, 165, 255, ${state.leftProbability * 0.15})`;
        context.fillRect(0, 0, width / 2, height);
        context.fillStyle = `rgba(255, 183, 102, ${state.rightProbability * 0.15})`;
        context.fillRect(width / 2, 0, width / 2, height);

        const centerX = ((0 + L / 2) / L) * width;
        context.setLineDash([4, 6]);
        context.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        context.beginPath();
        context.moveTo(centerX, 0);
        context.lineTo(centerX, height);
        context.stroke();
        context.setLineDash([]);
      }

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [stateRef]);

  return <canvas ref={canvasRef} className={compact ? styles.compact : styles.canvas} />;
}

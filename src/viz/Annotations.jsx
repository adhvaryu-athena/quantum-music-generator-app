import styles from './Annotations.module.css';

const buildMessages = ({ leftProbability, rightProbability, beatFrequency }) => {
  const messages = [];
  if (leftProbability > 0.7) {
    messages.push('← wave mostly left · left speaker louder');
  }
  if (rightProbability > 0.7) {
    messages.push('wave mostly right · right speaker louder →');
  }
  if (Math.abs(leftProbability - rightProbability) < 0.1) {
    messages.push('wave balanced · equal stereo');
  }
  if (beatFrequency < 1) {
    messages.push('slow quantum beating · close energy levels');
  }
  if (beatFrequency > 3) {
    messages.push('fast quantum oscillation · large energy gap');
  }
  return messages;
};

export default function Annotations({ leftProbability, rightProbability, beatFrequency }) {
  const messages = buildMessages({ leftProbability, rightProbability, beatFrequency });

  return (
    <div className={styles.strip}>
      {messages.map((message) => (
        <span key={message} className={styles.message}>
          {message}
        </span>
      ))}
    </div>
  );
}

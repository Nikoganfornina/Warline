import React, { useState } from 'react';
import GameCanvas from './GameCanvas';

export default function Menu() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ color: '#fff' }}>Epic War Lite</h1>
        <button onClick={() => setStarted(true)}>Jugar</button>
        <p style={{ color: '#aaa' }}>Pequeña demo MVP — SVG + motor separado</p>
      </div>
    );
  }

  return <GameCanvas onExit={() => setStarted(false)} />;
}

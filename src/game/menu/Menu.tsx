import { useState } from 'react';
import GameCanvas from '../GameCanvas';
import portada from '../../assets/images/portada.jpg';
import './menu.scss';

export default function Menu() {
  const [screen, setScreen] = useState<'menu' | 'historia'>('menu');

  if (screen === 'historia') {
    return <GameCanvas onExit={() => setScreen('menu')} />;
  }

  

  return (

    <div className="menu-root" >

        <img src={portada} alt="Portada" className="menu-image" />
      <div className="menu-buttons">
        <button className="menu-button" onClick={() => setScreen('historia')}>Historia</button>
        <button className="menu-button" disabled>1vs1</button>
        <button className="menu-button" disabled>Online</button>
        <button className="menu-button" disabled>Próximamente</button>
      </div>

    </div>
  );
}

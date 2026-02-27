import './styles/global.scss'
import './App.css'
import Menu from './game/menu/Menu'

export default function App() {
  return (
    <div className="app-root">
      <div className="app-container">
        <Menu />
      </div>
    </div>
  )
}

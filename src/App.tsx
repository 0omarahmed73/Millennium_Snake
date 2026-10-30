import { AppProvider, useApp } from './services/AppContext';
import type { SaveData } from './services/storage';
import { MainMenu } from './screens/MainMenu/MainMenu';
import { GameScreen } from './screens/Game/GameScreen';
import { GameOver } from './screens/GameOver/GameOver';
import { Collection } from './screens/Collection/Collection';
import { Settings } from './screens/Settings/Settings';
import { Credits, HowToPlay } from './screens/Info';

function Router() {
  const { screen, transitioning } = useApp();
  return (
    <div className={`app ${transitioning ? 'is-transitioning' : ''}`}>
      <div className="screen-host" key={screen}>
        {screen === 'menu' && <MainMenu />}
        {screen === 'game' && <GameScreen />}
        {screen === 'gameover' && <GameOver />}
        {screen === 'collection' && <Collection />}
        {screen === 'settings' && <Settings />}
        {screen === 'credits' && <Credits />}
        {screen === 'howto' && <HowToPlay />}
      </div>
      <div className="portal" aria-hidden />
    </div>
  );
}

export function App({ initial }: { initial: SaveData }) {
  return (
    <AppProvider initial={initial}>
      <Router />
    </AppProvider>
  );
}

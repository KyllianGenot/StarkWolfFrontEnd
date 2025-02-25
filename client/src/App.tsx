import { useState } from 'react';
import Lobby from './components/Lobby';
import Game from './components/Game';

type GameState = 'lobby' | 'in-game';

function App() {
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [gameId, setGameId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 text-white">
      {gameState === 'lobby' ? (
        <Lobby onJoinGame={(id) => {
          setGameId(id);
          setGameState('in-game');
        }} />
      ) : (
        <Game gameId={gameId!} onLeaveGame={() => setGameState('lobby')} />
      )}
    </div>
  );
}

export default App;
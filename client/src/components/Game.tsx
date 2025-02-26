import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Shield, Volume2, VolumeX, Clock, Sun, Moon, Skull, ArrowUp, X, UserCheck, Eye, Vote } from 'lucide-react';
import defaultAvatar from '../assets/images/avatars/default-avatar.png';
import playerAvatar from '../assets/images/cards/seer.webp';
import backgroundNight from '../assets/images/backgrounds/background_night.webp';
import backgroundDay from '../assets/images/backgrounds/background_day.webp';
import villagerCard from '../assets/images/cards/villager.webp';
import werewolfCard from '../assets/images/cards/werewolf.webp';
import seerCard from '../assets/images/cards/seer.webp';
import hunterCard from '../assets/images/cards/hunter.webp';
import cupidCard from '../assets/images/cards/cupid.webp';
import witchCard from '../assets/images/cards/witch.webp';
import guardCard from '../assets/images/cards/guard.webp';
import deadCard from '../assets/images/cards/dead.webp';
import logo from '../assets/images/logos/logo.webp';

// Game timing constants
const DAY_VOTING_DURATION = 30; // Duration of the day voting phase in seconds
const TURN_DURATION = 15;       // Duration of each role's turn in seconds
const GAME_START_COUNTDOWN = 30;// Countdown duration before the game begins in seconds

// Type definitions
type Role = 'villager' | 'werewolf' | 'seer' | 'witch' | 'hunter' | 'guard' | 'cupid';

interface Player {
  id: number;
  name: string;
  role: Role;
  status: 'alive' | 'dead';
  position: { x: number; y: number };
  voteCount: number;
  isProtected: boolean;
  hasDeathPopupShown?: boolean;
  isPlayer?: boolean;
  loverId?: number; // ID of the player's lover, if any
}

interface RoleInfo {
  name: string;
  image: string;
  role: Role;
  isEvil?: boolean;
}

interface PopupState {
  show: boolean;
  title: string;
  message: string;
  type: 'death' | 'gameOver' | 'turn' | 'seerReveal' | 'voteResult' | 'lovers';
  role?: Role;
  playerName?: string;
  isVillageWin?: boolean;
}

interface ChatMessage {
  id: string;
  content: string;
  playerName: string;
}

interface GameProps {
  gameId: string;
  onLeaveGame: () => void;
}

// Predefined roles with their properties
const ROLES: RoleInfo[] = [
  { name: "Cupid", image: cupidCard, role: "cupid" },
  { name: "Guard", image: guardCard, role: "guard" },
  { name: "Seer", image: seerCard, role: "seer" },
  { name: "Hunter", image: hunterCard, role: "hunter" },
  { name: "Werewolf", image: werewolfCard, role: "werewolf", isEvil: true },
  { name: "Witch", image: witchCard, role: "witch" },
  { name: "Villager", image: villagerCard, role: "villager" },
];

// Initial player setup
const INITIAL_PLAYERS: Player[] = [
  { id: 1, name: "Emma", role: "werewolf", status: "alive", position: { x: 0, y: 0 }, voteCount: 0, isProtected: false },
  { id: 2, name: "Luna", role: "witch", status: "alive", position: { x: 0, y: 0 }, voteCount: 0, isProtected: false },
  { id: 3, name: "PlayerX", role: "seer", status: "alive", position: { x: 0, y: 0 }, voteCount: 0, isProtected: false, isPlayer: true },
  { id: 4, name: "Alex", role: "guard", status: "alive", position: { x: 0, y: 0 }, voteCount: 0, isProtected: false },
  { id: 5, name: "Grace", role: "hunter", status: "alive", position: { x: 0, y: 0 }, voteCount: 0, isProtected: false },
  { id: 6, name: "Olivia", role: "cupid", status: "alive", position: { x: 0, y: 0 }, voteCount: 0, isProtected: false },
  { id: 7, name: "James", role: "villager", status: "alive", position: { x: 0, y: 0 }, voteCount: 0, isProtected: false },
  { id: 8, name: "Sophie", role: "villager", status: "alive", position: { x: 0, y: 0 }, voteCount: 0, isProtected: false },
];

// Utility functions

// Formats time in MM:SS format
const formatTime = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

// Calculates player positions in a circular layout
const calculateCirclePositions = (players: Player[], radius: number, centerX: number, centerY: number): Player[] => {
  const numPlayers = players.length;
  const playerIndex = players.findIndex(p => p.isPlayer);
  const bottomAngle = Math.PI / 2;

  return players.map((player, i) => {
    const angleOffset = playerIndex !== -1 ? bottomAngle - ((playerIndex * 2 * Math.PI) / numPlayers) : 0;
    const angle = (i * 2 * Math.PI) / numPlayers + angleOffset;
    return {
      ...player,
      position: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
    };
  });
};

// Main Game Component
const Game: React.FC<GameProps> = ({ onLeaveGame }) => {
  const [username, setUsername] = useState<string>("");
  const [showRolePopup, setShowRolePopup] = useState<boolean>(true);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(GAME_START_COUNTDOWN);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [phase, setPhase] = useState<'day' | 'night'>('night');
  const [day, setDay] = useState(1);
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
  const [currentTurn, setCurrentTurn] = useState<Role | 'day' | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [popupQueue, setPopupQueue] = useState<PopupState[]>([]);
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [deadCount, setDeadCount] = useState<number>(0);
  const [messageInput, setMessageInput] = useState<string>('');
  const [isPlayerDead, setIsPlayerDead] = useState<boolean>(false);
  const [hasSeerUsedPower, setHasSeerUsedPower] = useState<boolean>(false);
  const [votes, setVotes] = useState<{ [key: number]: number[] }>({}); // Tracks votes per player
  const [hasVoted, setHasVoted] = useState<boolean>(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef({
    ambience: new Audio('/sounds/night-ambience.mp3'),
    wolf: new Audio('/sounds/wolf-howl.mp3'),
    bell: new Audio('/sounds/village-bell.mp3'),
  });

  // Derived state for game statistics
  const aliveWerewolves = players.filter(p => p.role === 'werewolf' && p.status === 'alive').length;
  const aliveVillagers = players.filter(p => p.role !== 'werewolf' && p.status === 'alive').length;
  const alivePlayersCount = players.filter(p => p.status === 'alive').length;
  const aliveRoles = ROLES.filter(role => players.some(p => p.role === role.role && p.status === 'alive'));
  const totalWerewolves = players.filter(p => p.role === 'werewolf').length;
  const totalNonWerewolves = players.filter(p => p.role !== 'werewolf').length;

  // Positions players in a circle based on game container size
  useEffect(() => {
    const updatePositions = () => {
      if (!gameContainerRef.current) return;
      const { width, height } = gameContainerRef.current.getBoundingClientRect();
      const centerX = width / 2.12;
      const centerY = height / 2.9;
      const radius = Math.min(width, height) * 0.28;
      setPlayers(prev => calculateCirclePositions(prev, radius, centerX, centerY));
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [gameStarted]);

  // Manages the countdown before the game starts
  useEffect(() => {
    if (isReady || countdown <= 0 || gameStarted) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameStarted(true);
          setShowRolePopup(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isReady, countdown, gameStarted]);

  // Updates the player's name when username changes
  useEffect(() => {
    const finalUsername = username.trim() || "PlayerX";
    setPlayers(prev =>
      prev.map(player =>
        player.isPlayer ? { ...player, name: finalUsername } : player
      )
    );
  }, [username]);

  // Updates the count of dead players
  useEffect(() => {
    setDeadCount(players.filter(p => p.status === 'dead').length);
  }, [players]);

  // Manages the game timer and turn progression
  useEffect(() => {
    if (!gameStarted) return;

    let interval: NodeJS.Timeout | null = null;

    if (phase === 'night') {
      const turnOrder: Role[] = day === 1
        ? ['cupid', 'guard', 'seer', 'werewolf', 'witch']
        : ['guard', 'seer', 'werewolf', 'witch'];

      const advanceTurn = () => {
        const currentIndex = currentTurn ? turnOrder.indexOf(currentTurn as Role) : -1;
        const nextTurn = currentIndex < turnOrder.length - 1 ? turnOrder[currentIndex + 1] : null;

        if (nextTurn) {
          setCurrentTurn(nextTurn);
          setTimeLeft(TURN_DURATION);
          const playerRole = players.find(p => p.isPlayer)?.role;
          const isPlayerTurn = playerRole === nextTurn && !isPlayerDead;
          setPopupQueue(prev => [
            ...prev,
            {
              show: true,
              title: isPlayerTurn ? `Your Turn as the ${nextTurn}!` : `${nextTurn.charAt(0).toUpperCase() + nextTurn.slice(1)}'s Turn`,
              message: isPlayerTurn && nextTurn === 'seer'
                ? "Click the eye icon on a living player's avatar to reveal their role (once per night)."
                : `The ${nextTurn} has 15 seconds to act.`,
              type: 'turn',
            } as PopupState,
          ]);
          if (nextTurn === 'seer') setHasSeerUsedPower(false);
          // Cupid's love effect: Makes Seer (PlayerX, id: 3) and James (id: 7) lovers 5 seconds after Cupid's turn popup
          if (nextTurn === 'cupid') {
            setTimeout(() => {
              setPlayers(prev =>
                prev.map(p =>
                  p.id === 3 ? { ...p, loverId: 7 } : // Seer loves James
                  p.id === 7 ? { ...p, loverId: 3 } : p // James loves Seer
                )
              );
              setPopupQueue(prev => [
                ...prev,
                {
                  show: true,
                  title: "Cupid's Arrow",
                  message: "PlayerX is in love with James!",
                  type: 'lovers',
                } as PopupState,
              ]);
            }, 5000); // 5 seconds delay
          }
        } else {
          setPhase('day');
          setCurrentTurn('day');
          setTimeLeft(DAY_VOTING_DURATION);
          if (soundEnabled) {
            audioRef.current.bell.play();
            audioRef.current.ambience.play();
          }
          const nightDeaths = players.filter(p => p.status === 'dead' && !p.hasDeathPopupShown);
          if (nightDeaths.length > 0) {
            const deathPopups: PopupState[] = nightDeaths.map(player => ({
              show: true,
              title: "Night Death",
              message: `${player.name} was killed during the night and was a ${player.role}.`,
              type: 'death',
              role: player.role,
              playerName: player.name,
            }));
            setPopupQueue(prev => [...prev, ...deathPopups]);
            setPlayers(prev => prev.map(p => p.status === 'dead' ? { ...p, hasDeathPopupShown: true } : p));
          }
        }
      };

      if (!currentTurn) {
        setCurrentTurn(turnOrder[0]);
        setTimeLeft(TURN_DURATION);
        const playerRole = players.find(p => p.isPlayer)?.role;
        const isPlayerTurn = playerRole === turnOrder[0] && !isPlayerDead;
        setPopupQueue(prev => [
          ...prev,
          {
            show: true,
            title: isPlayerTurn ? `Your Turn as the ${turnOrder[0]}!` : `${turnOrder[0].charAt(0).toUpperCase() + turnOrder[0].slice(1)}'s Turn`,
            message: isPlayerTurn && turnOrder[0] === 'seer'
              ? "Click the eye icon on a living player's avatar to reveal their role (once per night)."
              : `The ${turnOrder[0]} has 15 seconds to act.`,
            type: 'turn',
          } as PopupState,
        ]);
      } else if (timeLeft === 0) {
        advanceTurn();
      }

      interval = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
    } else if (phase === 'day') {
      interval = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [gameStarted, phase, currentTurn, timeLeft, day, soundEnabled, isPlayerDead]);

  // Handles the end of the day phase and voting results
  useEffect(() => {
    if (phase !== 'day') return;

    const checkVoteCompletion = () => {
      const totalVotes = Object.values(votes).reduce((acc, v) => acc + v.length, 0);
      if (timeLeft === 0 || totalVotes === alivePlayersCount) {
        const voteCounts = players.reduce((acc, player) => {
          acc[player.id] = (votes[player.id] || []).length;
          return acc;
        }, {} as { [key: number]: number });

        const maxVotes = Math.max(...Object.values(voteCounts));
        const playersToKill = players.filter(p => voteCounts[p.id] === maxVotes && p.status === 'alive');
        if (playersToKill.length > 0) {
          const killedPlayer = playersToKill[0];
          setPlayers(prev => {
            let updatedPlayers = prev.map(p =>
              p.id === killedPlayer.id ? { ...p, status: 'dead' as const, hasDeathPopupShown: true } : p
            );
            // Check for lover death
            const lover = updatedPlayers.find(p => p.id === killedPlayer.loverId && p.status === 'alive');
            if (lover) {
              updatedPlayers = updatedPlayers.map(p =>
                p.id === lover.id ? { ...p, status: 'dead' as const, hasDeathPopupShown: true } : p
              );
              setPopupQueue(prevQueue => [
                ...prevQueue,
                {
                  show: true,
                  title: "Lover's Tragedy",
                  message: `${lover.name} died of a broken heart after ${killedPlayer.name}'s death.`,
                  type: 'death',
                  role: lover.role,
                  playerName: lover.name,
                } as PopupState,
              ]);
            }
            return updatedPlayers;
          });
          setPopupQueue(prev => [
            ...prev,
            {
              show: true,
              title: "Vote Result",
              message: `${killedPlayer.name} received the most votes (${maxVotes}) and was a ${killedPlayer.role}.`,
              type: 'voteResult',
              role: killedPlayer.role,
              playerName: killedPlayer.name,
            } as PopupState,
          ]);
        }
        setPhase('night');
        setDay(prev => prev + 1);
        setTimeLeft(TURN_DURATION);
        setCurrentTurn(null);
        setVotes({});
        setHasVoted(false);
        if (soundEnabled) {
          audioRef.current.wolf.play();
          audioRef.current.ambience.pause();
        }
      }
    };

    checkVoteCompletion();
  }, [timeLeft, votes, alivePlayersCount, phase, soundEnabled]);

  // Handles a player's death and displays appropriate popup
  const handlePlayerDeath = (playerId: number) => {
    setPlayers(prev => {
      const newPlayers = [...prev];
      const playerIndex = newPlayers.findIndex(p => p.id === playerId);

      if (playerIndex === -1) return newPlayers;

      const player = newPlayers[playerIndex];
      newPlayers[playerIndex] = { ...player, status: 'dead', hasDeathPopupShown: true };

      const isSelf = player.isPlayer;
      const isWerewolf = player.role === 'werewolf';
      const deathPopup: PopupState = {
        show: true,
        title: isSelf ? "You Have Died!" : isWerewolf ? "A Werewolf Has Died!" : "A Villager Has Died!",
        message: isSelf
          ? `You were a ${player.role}. Your journey ends here!`
          : `${player.name} has been eliminated from the game.`,
        type: 'death',
        role: player.role,
        playerName: player.name,
      };

      setPopupQueue(prev => [...prev, deathPopup]);
      if (isSelf) setIsPlayerDead(true);

      // Check for lover death
      const lover = newPlayers.find(p => p.id === player.loverId && p.status === 'alive');
      if (lover) {
        const loverIndex = newPlayers.findIndex(p => p.id === lover.id);
        newPlayers[loverIndex] = { ...lover, status: 'dead', hasDeathPopupShown: true };
        setPopupQueue(prevQueue => [
          ...prevQueue,
          {
            show: true,
            title: "Lover's Tragedy",
            message: `${lover.name} died of a broken heart after ${player.name}'s death.`,
            type: 'death',
            role: lover.role,
            playerName: lover.name,
          } as PopupState,
        ]);
      }

      return newPlayers;
    });
  };

  // Handles the seer's role reveal action
  const handleSeerReveal = (targetId: number) => {
    if (hasSeerUsedPower) return;

    const target = players.find(p => p.id === targetId);
    if (!target || target.status === 'dead') return;

    setPopupQueue(prev => [
      ...prev,
      {
        show: true,
        title: "Seer's Vision",
        message: `${target.name} is a ${target.role}!`,
        type: 'seerReveal',
        role: target.role,
        playerName: target.name,
      } as PopupState,
    ]);
    setHasSeerUsedPower(true);
    setSelectedPlayer(null);
    const currentIndex = currentTurn
      ? (['cupid', 'guard', 'seer', 'werewolf', 'witch'] as Role[]).indexOf(currentTurn as Role)
      : -1;
    const nextTurn = currentIndex < 4 ? (['cupid', 'guard', 'seer', 'werewolf', 'witch'] as Role[])[currentIndex + 1] : null;
    if (nextTurn) {
      setCurrentTurn(nextTurn);
      setTimeLeft(TURN_DURATION);
      setPopupQueue(prev => [
        ...prev,
        {
          show: true,
          title: `${nextTurn.charAt(0).toUpperCase() + nextTurn.slice(1)}'s Turn`,
          message: `The ${nextTurn} has 15 seconds to act.`,
          type: 'turn',
        } as PopupState,
      ]);
    } else {
      setPhase('day');
      setCurrentTurn('day');
      setTimeLeft(DAY_VOTING_DURATION);
      if (soundEnabled) {
        audioRef.current.bell.play();
        audioRef.current.ambience.play();
      }
    }
  };

  // Manages player voting during the day phase
  const handleVote = (targetId: number) => {
    if (hasVoted || isPlayerDead || phase !== 'day') return;

    const voterId = players.find(p => p.isPlayer)?.id;
    if (!voterId) return;

    setVotes(prev => ({
      ...prev,
      [targetId]: [...(prev[targetId] || []), voterId],
    }));
    setHasVoted(true);
  };

  // Checks for victory or defeat conditions
  useEffect(() => {
    if (!gameStarted || players.length === 0) return;

    const unshownDeaths = players.filter(p => p.status === 'dead' && !p.hasDeathPopupShown);
    if (unshownDeaths.length > 0 && phase !== 'day') {
      const deathPopups = unshownDeaths.map(player => ({
        show: true,
        title: player.isPlayer ? "You Have Died!" : player.role === 'werewolf' ? "A Werewolf Has Died!" : "A Villager Has Died!",
        message: player.isPlayer
          ? `You were a ${player.role}. Your journey ends here!`
          : `${player.name} has been eliminated from the game.`,
        type: 'death',
        role: player.role,
        playerName: player.name,
      } as PopupState));
      setPopupQueue(prev => [...prev, ...deathPopups]);
      setPlayers(prev => prev.map(p => p.status === 'dead' ? { ...p, hasDeathPopupShown: true } : p));
      if (unshownDeaths.some(p => p.isPlayer)) setIsPlayerDead(true);
    } else if (aliveWerewolves === 0) {
      setPopupQueue(prev => [
        ...prev,
        {
          show: true,
          title: "Victory!",
          message: "The village has prevailed!",
          type: 'gameOver',
          isVillageWin: true,
        } as PopupState,
      ]);
    } else if (aliveVillagers === 0 || aliveWerewolves >= aliveVillagers) {
      setPopupQueue(prev => [
        ...prev,
        {
          show: true,
          title: "Defeat!",
          message: "The werewolves reign supreme...",
          type: 'gameOver',
          isVillageWin: false,
        } as PopupState,
      ]);
    }
  }, [players, aliveWerewolves, aliveVillagers, gameStarted, phase]);

  // Sends a message to the chat
  const handleSendMessage = (content: string) => {
    if (!content.trim()) return;
    setChatMessages(prev => [
      ...prev,
      { id: Date.now().toString(), content, playerName: username.trim() || 'PlayerX' },
    ]);
    setMessageInput('');
  };

  // Closes the current popup and handles game over navigation
  const handlePopupClose = () => {
    const [currentPopup, ...rest] = popupQueue;
    setPopupQueue(rest);
    if (currentPopup.type === 'gameOver') {
      onLeaveGame();
    }
  };

  // Manually starts the game when the player is ready
  const handleReadyClick = () => {
    setIsReady(true);
    setGameStarted(true);
    setShowRolePopup(false);
  };

  const player = players.find(p => p.isPlayer);
  const playerRole = player?.role || 'seer';
  const isEvil = playerRole === "werewolf";
  const roleColor = isEvil ? "red" : "blue";
  const roleInfo = ROLES.find(r => r.role === playerRole);
  const isSeerTurn = currentTurn === 'seer' && playerRole === 'seer' && !isPlayerDead;
  const isVotingPhase = phase === 'day' && currentTurn === 'day';

  // Component rendering
  return (
    <>
      <style jsx global>{`
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        @font-face {
          font-family: 'Clash Display';
          src: url('/fonts/ClashDisplay-Semibold.woff2') format('woff2'),
               url('/fonts/ClashDisplay-Semibold.woff') format('woff');
          font-weight: 600;
          font-style: normal;
          font-display: swap;
        }
        .font-clash-display { font-family: 'Clash Display', sans-serif; }
        .animate-pulse-slow { animation: pulse-slow 5s ease-in-out infinite; }
        @keyframes pulse-slow { 0%, 100% { text-shadow: 0 0 20px rgba(153, 27, 27, 0.5); } 50% { text-shadow: 0 0 30px rgba(153, 27, 27, 0.7); } }
        .glow { animation: glow 1.5s infinite alternate; }
        @keyframes glow { 
          0% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
          100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.8); }
        }
        .sparkle { animation: sparkle 2s infinite; }
        @keyframes sparkle {
          0% { transform: scale(1) translate(0, 0); opacity: 0; }
          50% { transform: scale(1.5) translate(5px, -5px); opacity: 1; }
          100% { transform: scale(1) translate(0, 0); opacity: 0; }
        }
        .smoke { animation: smoke 2s infinite; }
        @keyframes smoke {
          0% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.1); opacity: 0.5; }
          100% { transform: translateY(-40px) scale(1.2); opacity: 0; }
        }
      `}</style>
      <div className={`font-[Crimson Text] h-screen w-screen flex flex-col overflow-hidden relative bg-[#1C233E] ${isPlayerDead ? 'border-4 border-red-600/70' : ''}`}>
        <AnimatePresence>
          {showRolePopup && (
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                background: isEvil
                  ? 'linear-gradient(135deg, rgba(153, 27, 27, 0.8), rgba(0, 0, 0, 0.8))'
                  : 'linear-gradient(135deg, rgba(30, 58, 138, 0.8), rgba(0, 0, 0, 0.8))',
              }}
            >
              <motion.div
                className="relative bg-gradient-to-br from-gray-950/90 to-gray-800/60 p-8 rounded-xl shadow-2xl border-2 border-gray-700/50 max-w-md w-full mx-4"
                initial={{ scale: 0, rotate: -5 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 5 }}
                transition={{ type: "spring", damping: 15, stiffness: 200 }}
              >
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-6 text-gray-100">
                    Welcome to <span className="text-red-800 font-clash-display">StarkWolf</span>
                  </h2>
                  <div className="mb-8">
                    <label className="block text-gray-300 text-lg mb-2">Enter your name:</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Your name (default: PlayerX)"
                      className="w-full px-4 py-2 bg-gray-900/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                  <motion.div
                    className="mb-8 flex justify-center"
                    initial={{ scale: 0, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", damping: 15, stiffness: 100, delay: 0.2 }}
                  >
                    <div className="relative w-40 h-56 mx-auto transform transition-transform hover:scale-105 duration-300">
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50 rounded-lg z-10" />
                      <img
                        src={roleInfo?.image || seerCard}
                        alt={playerRole}
                        className="w-full h-full object-contain rounded-xl border-2 border-blue-500/70 shadow-lg shadow-blue-500/20"
                      />
                      <div className="absolute bottom-3 left-0 right-0 text-center text-white text-xl font-bold z-20">
                        Your Role: <span className={`text-${roleColor}-400 capitalize`}>{playerRole}</span>
                      </div>
                    </div>
                  </motion.div>
                  <div className="mb-6 text-center">
                    <div className="text-xl text-gray-100 mb-2">
                      {isReady ? "Starting now!" : `Game starts in ${countdown} seconds`}
                    </div>
                  </div>
                  <motion.button
                    onClick={handleReadyClick}
                    className="px-8 py-3 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold rounded-lg transition-all duration-300 shadow-md"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <UserCheck size={20} />
                      I'm Ready
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative z-10 flex flex-col h-full">
          <header className="bg-gray-900/20 backdrop-blur-md border-b border-red-900/30 h-16 flex items-center px-4 gap-4 flex-shrink-0">
            <button onClick={onLeaveGame}>
              <ArrowLeft size={24} className="text-red-400" />
            </button>
            <img src={logo} alt="StarkWolf Logo" className="h-10 w-auto object-contain" />
            <div className="flex items-center gap-2 bg-gray-900/60 px-3 py-1 rounded-full border border-red-900/40 text-red-100">
              <Clock size={16} /> {formatTime(timeLeft)}
            </div>
            <div className="flex items-center gap-2 bg-gray-900/60 px-3 py-1 rounded-full border border-red-900/40 text-red-100">
              {phase === 'night' ? <Moon size={16} /> : <Sun size={16} />} Day {day}
            </div>
            <button className="ml-auto" onClick={() => setSoundEnabled(!soundEnabled)}>
              {soundEnabled ? <Volume2 size={24} className="text-red-400" /> : <VolumeX size={24} className="text-red-400" />}
            </button>
          </header>
          <div className="flex flex-1 overflow-hidden">
            <div
              ref={gameContainerRef}
              className="relative flex-1 overflow-hidden"
              style={{ backgroundImage: `url(${backgroundDay})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <div
                className="absolute inset-0 transition-opacity duration-1000"
                style={{
                  backgroundImage: `url(${backgroundNight})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: phase === 'night' ? 1 : 0,
                }}
              />
              <div className="absolute inset-0 overflow-hidden">
                {players.map(player => (
                  <motion.div
                    key={player.id}
                    className={`absolute ${player.status === 'dead' ? 'opacity-30' : 'cursor-pointer'}`}
                    style={{ x: player.position.x, y: player.position.y }}
                    animate={{ scale: selectedPlayer === player.id ? 1.1 : 1 }}
                    onClick={() => {
                      if (player.status === 'alive') {
                        setSelectedPlayer(player.id);
                        if (isSeerTurn && !hasSeerUsedPower) {
                          handleSeerReveal(player.id);
                        }
                      }
                    }}
                  >
                    <div className="relative">
                      <img
                        src={player.isPlayer ? playerAvatar : defaultAvatar}
                        alt={player.name}
                        className={`w-16 h-16 rounded-full border-2 ${player.isPlayer
                          ? 'border-blue-500 shadow-lg shadow-blue-500/30 scale-110 object-cover'
                          : 'border-red-900/30 object-contain'}`}
                      />
                      {player.status === 'dead' && (
                        <Skull
                          size={30}
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500/80"
                        />
                      )}
                      {player.isProtected && (
                        <Shield size={12} className="absolute -top-1 -right-1 text-red-400" />
                      )}
                      {player.status === 'alive' && isSeerTurn && !hasSeerUsedPower && (
                        <Eye
                          size={20}
                          className="absolute bottom-0 right-0 text-yellow-400 bg-gray-800/70 rounded-full p-1 cursor-pointer hover:text-yellow-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSeerReveal(player.id);
                          }}
                        />
                      )}
                      {player.status === 'alive' && phase === 'day' && currentTurn === 'day' && !hasVoted && !isPlayerDead && (
                        <button
                          onClick={() => handleVote(player.id)}
                          className="absolute bottom-0 right-0 text-blue-400 bg-gray-800/70 rounded-full p-1 cursor-pointer hover:text-blue-300"
                        >
                          <Vote size={16} />
                        </button>
                      )}
                      {player.status === 'alive' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayerDeath(player.id);
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-600/70 rounded-full flex items-center justify-center text-white hover:bg-red-700 transition-colors duration-200"
                        >
                          <Skull size={14} />
                        </button>
                      )}
                    </div>
                    <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-sm ${player.isPlayer
                      ? 'bg-blue-900/70 border-blue-700/60 text-blue-100'
                      : 'bg-gray-900/60 border-red-900/40 text-red-300'
                      } px-3 py-1 rounded-full font-semibold whitespace-nowrap border shadow-md`}>
                      {player.name}
                      {player.status === 'dead' && (
                        <span className="ml-1 text-xs text-gray-400 italic">({player.role})</span>
                      )}
                      {isVotingPhase && votes[player.id] && (
                        <span className="ml-1 text-xs text-yellow-400">({votes[player.id].length} votes)</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="absolute bottom-2 left-0 right-0 flex justify-center items-center gap-4 z-10 px-4">
                <div className="flex gap-2 backdrop-blur-sm bg-gray-950/40 p-2 rounded-lg border border-red-900/30">
                  {aliveRoles.map(role => (
                    <motion.div
                      key={role.name}
                      className={`relative w-20 h-28 rounded-lg overflow-hidden border-2 ${role.isEvil ? 'border-red-600/70' : 'border-red-400/70'
                        } shadow-lg ${role.isEvil ? 'shadow-red-900/30' : 'shadow-red-800/30'
                        } bg-gradient-to-t from-gray-950/60 to-transparent transition-transform duration-200 hover:scale-105 ${currentTurn === role.role ? 'scale-125 glow z-20' : ''}`}
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: currentTurn === role.role ? -40 : 0, opacity: 1 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                    >
                      <img src={role.image} alt={role.name} className="w-full h-full object-cover" />
                      <div
                        className={`absolute top-1 right-1 ${role.isEvil ? 'bg-red-600/80' : 'bg-red-400/80'
                          } rounded-full w-6 h-6 flex items-center justify-center text-black text-xs font-bold border ${role.isEvil ? 'border-red-800/50' : 'border-red-600/50'
                          } shadow-md`}
                      >
                        {players.filter(p => p.role === role.role && p.status === 'alive').length}
                      </div>
                      <div
                        className={`absolute bottom-1 left-0 right-0 text-center ${role.isEvil ? 'text-red-200' : 'text-red-100'
                          } text-xs font-semibold bg-gray-900/60 py-0.5`}
                      >
                        {role.name}
                      </div>
                    </motion.div>
                  ))}
                  <motion.div
                    className="relative w-20 h-28 rounded-lg overflow-hidden border-2 border-gray-600/70 shadow-lg shadow-gray-900/30 bg-gradient-to-t from-gray-950/60 to-transparent transition-transform duration-200 hover:scale-105"
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <img src={deadCard} alt="Dead" className="w-full h-full object-cover" />
                    <div className="absolute top-1 right-1 bg-gray-600/80 rounded-full w-6 h-6 flex items-center justify-center text-black text-xs font-bold border border-gray-800/50 shadow-md">
                      {deadCount}
                    </div>
                    <div className="absolute bottom-1 left-0 right-0 text-center text-gray-200 text-xs font-semibold bg-gray-900/60 py-0.5">
                      Dead
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
            <div className="w-72 bg-gray-950/40 backdrop-blur-md border-l border-red-900/30 p-4 flex flex-col gap-4 flex-shrink-0 overflow-hidden">
              <div>
                <h2 className="text-xl font-bold text-red-400">Status</h2>
                <div className="mt-2 space-y-3 text-red-100">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Werewolves:</span>
                      <span>{aliveWerewolves}/{totalWerewolves}</span>
                    </div>
                    <div className="w-full bg-gray-900/60 rounded-full h-2 overflow-hidden border border-red-900/40">
                      <div
                        className="bg-red-600 h-full rounded-full"
                        style={{ width: `${(aliveWerewolves / totalWerewolves) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Village:</span>
                      <span>{aliveVillagers}/{totalNonWerewolves}</span>
                    </div>
                    <div className="w-full bg-gray-900/60 rounded-full h-2 overflow-hidden border border-red-900/40">
                      <div
                        className="bg-red-400 h-full rounded-full"
                        style={{ width: `${(aliveVillagers / totalNonWerewolves) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden">
                <h2 className="text-xl font-bold text-red-400">Chat</h2>
                <div
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto mt-2 space-y-3 p-2 bg-gray-900/60 rounded-lg border border-red-900/40 shadow-inner"
                >
                  {chatMessages.map(msg => (
                    <motion.div
                      key={msg.id}
                      className="bg-gradient-to-r from-red-900/30 to-gray-900/50 p-3 rounded-lg shadow-md border border-red-900/40 hover:bg-red-900/40 transition-colors duration-200"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <span className="font-medium text-red-300">{msg.playerName}:</span>
                      <span className="ml-2 text-red-100">{msg.content}</span>
                    </motion.div>
                  ))}
                </div>
                <form
                  className="mt-3 flex gap-2 flex-shrink-0 items-center"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage(messageInput);
                  }}
                >
                  <input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="flex-1 bg-gray-900/60 p-2 rounded-lg border border-red-900/40 text-red-100 placeholder-red-400/50 focus:outline-none focus:border-red-800 transition-all duration-200 text-sm"
                    placeholder="Type a message..."
                  />
                  <button
                    type="submit"
                    className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-gray-100 font-semibold rounded-lg transition-all duration-200 shadow-md"
                  >
                    <ArrowUp size={18} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {popupQueue.length > 0 && (
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className={`relative p-6 rounded-xl shadow-2xl border-4 max-w-md w-full mx-4 overflow-hidden ${
                  popupQueue[0].type === 'gameOver' && popupQueue[0].isVillageWin
                    ? 'bg-gradient-to-br from-yellow-800/90 to-yellow-600/60 border-yellow-500'
                    : popupQueue[0].type === 'gameOver'
                    ? 'bg-gradient-to-br from-red-900/90 to-gray-900/60 border-red-700'
                    : 'bg-gradient-to-br from-gray-950/90 to-red-950/60 border-red-900/30'
                }`}
                initial={{ scale: 0, rotate: -10, y: 100 }}
                animate={{ scale: 1, rotate: 0, y: 0 }}
                exit={{ scale: 0, rotate: 10, y: -100 }}
                transition={{ type: "spring", damping: 15, stiffness: 200, duration: 0.7 }}
              >
                <div className="text-center relative z-10">
                  <h2 className={`text-4xl font-bold mb-6 ${popupQueue[0].type === 'gameOver' && popupQueue[0].isVillageWin ? 'text-yellow-200' : 'text-red-400'} animate-pulse-slow`}>
                    {popupQueue[0].title}
                  </h2>
                  {(popupQueue[0].type === 'death' || popupQueue[0].type === 'seerReveal' || popupQueue[0].type === 'voteResult') && popupQueue[0].role && (
                    <motion.div
                      className="flex justify-center mb-6"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", damping: 10, stiffness: 150 }}
                    >
                      <div className="relative w-28 h-40 mx-auto">
                        <img
                          src={ROLES.find(r => r.role === popupQueue[0].role)?.image || deadCard}
                          alt={popupQueue[0].role}
                          className="w-full h-full object-cover rounded-lg border-2 border-red-500/70 shadow-lg"
                        />
                        {popupQueue[0].type === 'death' && (
                          <X size={48} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500" />
                        )}
                      </div>
                    </motion.div>
                  )}
                  {popupQueue[0].type === 'gameOver' && (
                    <motion.div
                      className="mb-6 relative"
                      initial={{ y: -50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                    >
                      {popupQueue[0].isVillageWin ? (
                        <div className="relative">
                          <motion.span
                            className="absolute sparkle"
                            style={{ top: '-30px', left: '-20px', color: '#FFD700', fontSize: '2rem' }}
                          >
                            ✨
                          </motion.span>
                          <motion.span
                            className="absolute sparkle"
                            style={{ top: '-30px', right: '-20px', color: '#FFD700', fontSize: '2rem' }}
                            transition={{ delay: 0.3 }}
                          >
                            ✨
                          </motion.span>
                          <motion.span
                            className="absolute sparkle"
                            style={{ bottom: '-20px', left: '0px', color: '#FFD700', fontSize: '2rem' }}
                            transition={{ delay: 0.6 }}
                          >
                            ✨
                          </motion.span>
                          <motion.span
                            className="text-8xl text-yellow-300"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            👑
                          </motion.span>
                        </div>
                      ) : (
                        <div className="relative">
                          <motion.span
                            className="absolute smoke"
                            style={{ top: '-20px', left: '20%', color: '#555', fontSize: '2rem' }}
                          >
                            💨
                          </motion.span>
                          <motion.span
                            className="absolute smoke"
                            style={{ top: '-20px', right: '20%', color: '#555', fontSize: '2rem' }}
                            transition={{ delay: 0.5 }}
                          >
                            💨
                          </motion.span>
                          <motion.span
                            className="text-8xl text-red-500"
                            animate={{ rotate: [-5, 5, -5], scale: [1, 1.05, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            💀
                          </motion.span>
                        </div>
                      )}
                    </motion.div>
                  )}
                  <motion.p
                    className="text-lg mb-6 text-white"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  >
                    {popupQueue[0].type === 'death' && popupQueue[0].playerName ? (
                      <>
                        <span className="font-bold text-red-300">{popupQueue[0].playerName}</span> was a{" "}
                        <span className="font-bold text-red-300 capitalize">{popupQueue[0].role}</span> and has been eliminated!
                      </>
                    ) : popupQueue[0].type === 'seerReveal' && popupQueue[0].playerName ? (
                      <>
                        <span className="font-bold text-red-300">{popupQueue[0].playerName}</span> is a{" "}
                        <span className="font-bold text-red-300 capitalize">{popupQueue[0].role}</span>!
                      </>
                    ) : popupQueue[0].type === 'voteResult' && popupQueue[0].playerName ? (
                      <>
                        <span className="font-bold text-red-300">{popupQueue[0].playerName}</span> was lynched and revealed as a{" "}
                        <span className="font-bold text-red-300 capitalize">{popupQueue[0].role}</span>!
                      </>
                    ) : (
                      popupQueue[0].message
                    )}
                  </motion.p>
                  <motion.button
                    onClick={handlePopupClose}
                    className={`px-6 py-2 font-bold rounded-lg transition-all duration-300 shadow-md ${
                      popupQueue[0].type === 'gameOver' && popupQueue[0].isVillageWin
                        ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-gray-900'
                        : 'bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-gray-100'
                    }`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15, stiffness: 300, delay: 0.5 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {popupQueue[0].type === 'gameOver' ? 'Back to Lobby' : 'Continue'}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default Game;
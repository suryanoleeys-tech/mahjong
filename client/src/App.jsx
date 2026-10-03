import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001', { autoConnect: false });
const MahjongTable3D = lazy(() => import('./MahjongTable3D'));

const SEATS = ['东', '南', '西', '北'];
const SUITS = ['万', '条', '桐'];
const WIND_TILES = ['东', '南', '西', '北'];
const HONOR_TILES = ['中', '发', '白'];
const FLOWER_TILES = ['春', '夏', '秋', '冬', '梅', '兰', '竹', '菊'];
const TILE_SUIT_ORDER = { 万: 0, 条: 1, 桐: 2, 字: 3, 花: 4 };
const HONOR_ORDER = { 东: 1, 南: 2, 西: 3, 北: 4, 中: 5, 发: 6, 白: 7 };
const HONOR_LABELS = { 东: '东风', 南: '南风', 西: '西风', 北: '北风', 中: '中', 发: '发', 白: '白板' };
function sortTiles(tiles) {
  return [...tiles].sort((left, right) => {
    const suitDifference = TILE_SUIT_ORDER[left.suit] - TILE_SUIT_ORDER[right.suit];
    if (suitDifference) return suitDifference;
    if (left.suit === '字') return HONOR_ORDER[left.value] - HONOR_ORDER[right.value];
    if (left.suit === '花') return FLOWER_TILES.indexOf(left.value) - FLOWER_TILES.indexOf(right.value);
    return Number(left.value) - Number(right.value);
  });
}

function arrangeHand(tiles) {
  const sorted = sortTiles(tiles);
  const remaining = [...sorted];
  const groups = [];
  const takeTiles = (matches) => {
    if (matches.length !== 3) return false;
    groups.push(matches);
    matches.forEach((tile) => {
      const index = remaining.findIndex((candidate) => candidate.id === tile.id);
      if (index >= 0) remaining.splice(index, 1);
    });
    return true;
  };

  for (const tile of sorted) {
    const triplet = remaining.filter((candidate) => candidate.label === tile.label).slice(0, 3);
    if (triplet.length === 3 && remaining.some((candidate) => candidate.id === tile.id)) takeTiles(triplet);
  }
  for (const tile of sorted) {
    if (!remaining.some((candidate) => candidate.id === tile.id) || tile.suit === '字' || tile.suit === '花' || tile.value > 7) continue;
    const matches = [tile];
    for (const value of [Number(tile.value) + 1, Number(tile.value) + 2]) {
      const match = remaining.find((candidate) => candidate.suit === tile.suit && Number(candidate.value) === value && !matches.includes(candidate));
      if (match) matches.push(match);
    }
    if (matches.length === 3) takeTiles(matches);
  }
  for (const tile of sorted) {
    const pair = remaining.filter((candidate) => candidate.label === tile.label).slice(0, 2);
    if (pair.length === 2 && remaining.some((candidate) => candidate.id === tile.id)) {
      groups.push(pair);
      pair.forEach((match) => {
        const index = remaining.findIndex((candidate) => candidate.id === match.id);
        if (index >= 0) remaining.splice(index, 1);
      });
    }
  }
  if (remaining.length) groups.push(sortTiles(remaining));
  return groups;
}

function TileFace({ tile }) {
  if (tile.suit === '桐') {
    const layouts = {
      1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]],
      4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
      6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
      7: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [2, 2]],
      8: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
      9: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]]
    };
    return (
      <span className="tile-face tile-dots">
        {(layouts[tile.value] || []).map(([column, row], index) => (
          <i key={`${column}-${row}`} className={`dot-color-${index % 3}`} style={{ gridColumn: column + 1, gridRow: row + 1 }} />
        ))}
      </span>
    );
  }
  if (tile.suit === '条') {
    return (
      <span className="tile-face tile-bamboo">
        {Array.from({ length: Number(tile.value) }, (_, index) => (
          <i key={index} className={`bamboo-color-${index % 3}`} />
        ))}
      </span>
    );
  }
  if (tile.suit === '万') {
    return <span className="tile-face tile-wan"><strong>{tile.value}</strong><small>萬</small></span>;
  }
  if (tile.suit === '花') {
    return <span className="tile-face tile-flower"><b>✿</b><small>{tile.label}</small></span>;
  }
  return <span className={`tile-face tile-honor honor-${tile.value}`}>{tile.label}</span>;
}

function shuffle(array) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function createDeck(tileSet = '136') {
  const deck = [];
  SUITS.forEach((suit) => {
    for (let value = 1; value <= 9; value += 1) {
      for (let count = 0; count < 4; count += 1) {
        deck.push({
          id: `${suit}-${value}-${count}-${Math.random().toString(16).slice(2)}`,
          suit,
          value,
          label: `${value}${suit}`,
          face: 'front'
        });
      }
    }
  });

  [...WIND_TILES, ...HONOR_TILES].forEach((tile) => {
    for (let count = 0; count < 4; count += 1) {
      deck.push({
        id: `${tile}-${count}-${Math.random().toString(16).slice(2)}`,
        suit: '字',
        value: tile,
        label: HONOR_LABELS[tile],
        face: 'front'
      });
    }
  });

  if (tileSet === '144') {
    FLOWER_TILES.forEach((tile) => {
      deck.push({
        id: `${tile}-${Math.random().toString(16).slice(2)}`,
        suit: '花',
        value: tile,
        label: `${tile}花`,
        face: 'front'
      });
    });
  }

  return shuffle(deck);
}

function buildDemoPlayers(playerName) {
  const players = SEATS.map((seat, index) => ({
    seat,
    name: index === 0 ? playerName || '玩家' : `玩家${index + 1}`,
    score: 1000,
    hand: [],
    discard: [],
    melds: [],
    isDealer: seat === '东'
  }));

  return players;
}

function drawPlayableTile(deck, flowers) {
  let tile = deck.shift();
  while (tile?.suit === '花') {
    flowers.push(tile);
    tile = deck.pop();
  }
  return tile || null;
}

function drawReplacementTile(deck, flowers) {
  let tile = deck.pop();
  while (tile?.suit === '花') {
    flowers.push(tile);
    tile = deck.pop();
  }
  return tile || null;
}

function dealHand(deck, count, flowers) {
  const hand = [];
  while (hand.length < count && deck.length > 0) {
    const tile = drawPlayableTile(deck, flowers);
    if (tile) hand.push(tile);
  }
  return hand;
}

function dealInitialGame(playerName, tileSet = '136', selectedDealerName = playerName || '玩家') {
  const players = buildDemoPlayers(playerName);
  const requestedDealerIndex = players.findIndex((player) => player.name === selectedDealerName);
  const dealerIndex = requestedDealerIndex < 0 ? 0 : requestedDealerIndex;
  const dealerName = players[dealerIndex].name;
  const deck = createDeck(tileSet);
  const orderedPlayers = SEATS.map((seat, seatIndex) => {
    const originalPlayer = players[(dealerIndex + seatIndex) % players.length];
    return {
      ...originalPlayer,
      seat,
      seatIndex,
      hand: [],
      discard: [],
      melds: [],
      flowers: [],
      drawnTileId: null,
      isDealer: seatIndex === 0
    };
  });

  orderedPlayers.forEach((player, seatIndex) => {
    player.hand = dealHand(deck, seatIndex === 0 ? 14 : 13, player.flowers);
    if (seatIndex === 0) player.drawnTileId = player.hand[player.hand.length - 1]?.id || null;
  });

  return {
    status: 'playing',
    tileSet,
    round: 1,
    dealerSeat: '东',
    dealerName,
    dealerRolls: [],
    diceRounds: [],
    currentSeat: '东',
    players: orderedPlayers,
    drawPile: deck,
    discardPile: [],
    roomCode: 'LOCAL',
    seatOrder: SEATS,
    rules: {
      dealerByDice: true,
      dealerStartsWith14: true,
      everyoneElseStartsWith13: true,
      flowersEnabled: tileSet === '144'
    }
  };
}

function handSizeBeforeDraw(player) {
  return 13 - player.melds.length * 3;
}

function isWinningHand(hand, meldCount = 0) {
  if (hand.length !== 14 - meldCount * 3) return false;
  const uniqueTiles = [...new Map(hand.map((tile) => [tile.label, tile])).values()]
    .sort((left, right) => left.suit.localeCompare(right.suit) || Number(left.value) - Number(right.value));
  const tileIndexes = new Map(uniqueTiles.map((tile, index) => [tile.label, index]));
  const counts = uniqueTiles.map((tile) => hand.filter((item) => item.label === tile.label).length);
  const canFinishMelds = (remaining) => {
    const first = remaining.findIndex((count) => count > 0);
    if (first === -1) return true;
    const tile = uniqueTiles[first];
    if (remaining[first] >= 3) {
      remaining[first] -= 3;
      if (canFinishMelds(remaining)) return true;
      remaining[first] += 3;
    }
    if (tile.suit !== '字' && tile.suit !== '花' && tile.value <= 7) {
      const next = tileIndexes.get(`${tile.value + 1}${tile.suit}`);
      const after = tileIndexes.get(`${tile.value + 2}${tile.suit}`);
      if (next !== undefined && after !== undefined && remaining[next] > 0 && remaining[after] > 0) {
        remaining[first] -= 1;
        remaining[next] -= 1;
        remaining[after] -= 1;
        if (canFinishMelds(remaining)) return true;
        remaining[first] += 1;
        remaining[next] += 1;
        remaining[after] += 1;
      }
    }
    return false;
  };

  for (const [index, tile] of uniqueTiles.entries()) {
    const count = counts[index];
    if (count < 2) continue;
    const remaining = [...counts];
    remaining[index] -= 2;
    if (canFinishMelds(remaining)) return true;
  }
  return false;
}

function getDiscardSuggestion(hand) {
  if (!hand.length) return null;
  const scores = hand.map((tile) => {
    if (tile.suit === '字' || tile.suit === '花') {
      return hand.filter((item) => item.label === tile.label).length === 1 ? 0 : 2;
    }
    const sameSuit = hand.filter((item) => item.suit === tile.suit);
    const adjacent = sameSuit.filter((item) => Math.abs(item.value - tile.value) <= 2).length;
    const duplicates = sameSuit.filter((item) => item.value === tile.value).length;
    return duplicates > 1 ? 5 : adjacent === 1 ? 0 : adjacent === 2 ? 1 : 3;
  });
  return hand[scores.indexOf(Math.min(...scores))];
}

function cloneGame(game) {
  return {
    ...game,
    players: game.players.map((player) => ({
      ...player,
      hand: [...player.hand],
      discard: [...player.discard],
      melds: [...(player.melds || [])],
      flowers: [...(player.flowers || [])]
    })),
    drawPile: [...game.drawPile],
    discardPile: [...game.discardPile]
  };
}

function matchesOf(player, tile) {
  return player.hand.filter((item) => item.label === tile.label);
}

function legalChiSets(player, tile) {
  if (tile.suit === '字' || tile.suit === '花') return [];
  const sets = [];
  for (let offset = -2; offset <= 0; offset += 1) {
    const values = [tile.value + offset, tile.value + offset + 1, tile.value + offset + 2];
    if (values[0] < 1 || values[2] > 9) continue;
    const selected = [];
    let valid = true;
    values.forEach((value) => {
      if (value === tile.value) return;
      const match = player.hand.find((item) => item.suit === tile.suit && item.value === value && !selected.includes(item));
      if (!match) valid = false;
      else selected.push(match);
    });
    if (valid) sets.push(selected);
  }
  return sets;
}

function listDiscardResponses(game, excludedName = null) {
  if (!game.pendingDiscard) return null;
  const discarderIndex = game.players.findIndex((player) => player.seat === game.pendingDiscard.seat);
  const tile = game.pendingDiscard.tile;
  const claims = [];
  for (let offset = 1; offset < game.players.length; offset += 1) {
    const player = game.players[(discarderIndex + offset) % game.players.length];
    if (player.name === excludedName) continue;
    const matches = matchesOf(player, tile);
    if (isWinningHand([...player.hand, tile], player.melds.length)) {
      claims.push({ player, type: 'win', matches: [] });
    } else if (matches.length >= 3) {
      claims.push({ player, type: 'kong', matches: matches.slice(0, 3) });
    } else if (matches.length >= 2) {
      claims.push({ player, type: 'pong', matches: matches.slice(0, 2) });
    } else if (offset === 1) {
      const chi = legalChiSets(player, tile)[0];
      if (chi) claims.push({ player, type: 'chi', matches: chi });
    }
  }
  return claims;
}

function findBotResponse(game, humanName) {
  const claims = listDiscardResponses(game, humanName);
  const priority = { win: 4, kong: 3, pong: 2, chi: 1 };
  return claims?.sort((left, right) => priority[right.type] - priority[left.type])[0] || null;
}

function applyClaimToGame(game, claim) {
  const nextGame = cloneGame(game);
  const player = nextGame.players.find((item) => item.seat === claim.player.seat);
  const pending = nextGame.pendingDiscard;
  const discarder = nextGame.players.find((item) => item.seat === pending.seat);
  const chosenIds = claim.matches.map((tile) => tile.id);
  const selected = player.hand.filter((tile) => chosenIds.includes(tile.id));
  player.hand = player.hand.filter((tile) => !chosenIds.includes(tile.id));
  const meldType = claim.type;
  player.melds.push({
    type: meldType,
    tiles: [...selected, pending.tile],
    concealed: false
  });
  discarder.discard = discarder.discard.filter((tile) => tile.id !== pending.tile.id);
  nextGame.discardPile = nextGame.discardPile.filter((tile) => tile.id !== pending.tile.id);
  nextGame.pendingDiscard = null;
  nextGame.awaitingResponses = false;
  nextGame.currentSeat = player.seat;

  if (claim.type === 'kong') {
    const supplement = drawReplacementTile(nextGame.drawPile, player.flowers);
    if (supplement) {
      player.hand.push(supplement);
      player.drawnTileId = supplement.id;
    }
    else nextGame.status = 'draw';
  }
  return nextGame;
}

function normalizePlayers(players, playerName) {
  const demo = buildDemoPlayers(playerName);
  return SEATS.map((seat, index) => {
    const roomPlayer = players?.[index];
    return {
      seat,
      name: roomPlayer?.name || demo[index].name,
      score: roomPlayer?.score || 1000,
      hand: roomPlayer?.hand || [],
      discard: roomPlayer?.discard || [],
      isDealer: roomPlayer?.isDealer || seat === '东',
      seatIndex: index
    };
  });
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('夯拉麻将馆');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('玩家');
  const [tileSet, setTileSet] = useState('136');
  const [tutorialMode, setTutorialMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [status, setStatus] = useState('未连接');
  const [roomInfo, setRoomInfo] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [actionEvent, setActionEvent] = useState(null);
  const [diceCeremony, setDiceCeremony] = useState(null);
  const [responseDeadline, setResponseDeadline] = useState(null);
  const [responseSeconds, setResponseSeconds] = useState(10);
  const [game, setGame] = useState(() => dealInitialGame('玩家', '136'));

  const playerList = useMemo(
    () => normalizePlayers(roomInfo?.players, playerName),
    [roomInfo, playerName]
  );

  const currentPlayer = useMemo(
    () => game.players.find((player) => player.seat === game.currentSeat) || game.players[0],
    [game]
  );

  const localHandGroups = useMemo(
    () => arrangeHand(game.players.find((player) => player.name === playerName)?.hand || []),
    [game, playerName]
  );
  const localHand = useMemo(() => localHandGroups.flat(), [localHandGroups]);
  const localPlayer = useMemo(
    () => game.players.find((player) => player.name === playerName),
    [game, playerName]
  );
  const suggestedTile = tutorialMode && localHand.length === handSizeBeforeDraw(localPlayer || { melds: [] }) + 1
    ? getDiscardSuggestion(localHand)
    : null;
  const pendingTile = game.pendingDiscard?.tile;
  const matchingPending = pendingTile && localPlayer ? matchesOf(localPlayer, pendingTile) : [];
  const chiChoices = pendingTile && localPlayer && SEATS[(SEATS.indexOf(game.pendingDiscard.seat) + 1) % SEATS.length] === localPlayer.seat
    ? legalChiSets(localPlayer, pendingTile)
    : [];
  const canClaimWin = pendingTile && localPlayer
    ? isWinningHand([...localHand, pendingTile], localPlayer.melds.length)
    : false;
  const localCanRespond = Boolean(canClaimWin || matchingPending.length >= 2 || chiChoices.length > 0);
  const canSelfWin = localPlayer && localHand.length === 14 - localPlayer.melds.length * 3
    ? isWinningHand(localHand, localPlayer.melds.length)
    : false;
  const concealedKongLabel = localPlayer?.hand.reduce((labels, tile) => {
    if (localPlayer.hand.filter((item) => item.label === tile.label).length === 4 && !labels.includes(tile.label)) labels.push(tile.label);
    return labels;
  }, [])[0];
  const addedKongTile = localPlayer?.melds
    .filter((meld) => meld.type === 'pong')
    .map((meld) => localHand.find((tile) => tile.label === meld.tiles[0].label))
    .find(Boolean);

  const playSound = (type) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const pitches = { draw: 520, discard: 270, chi: 430, pong: 360, kong: 620, win: 780, turn: 560 };
    oscillator.type = 'sine';
    oscillator.frequency.value = pitches[type] || 440;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.21);
    oscillator.onended = () => context.close();
  };

  const announceAction = (type, message, tile = null) => {
    const nextEvent = { id: Date.now() + Math.random(), type, message, tile };
    setActionEvent(nextEvent);
    playSound(type);
    window.setTimeout(() => {
      setActionEvent((current) => current?.id === nextEvent.id ? null : current);
    }, type === 'win' ? 4200 : 1800);
  };

  const finishGame = (nextGame, winner, mode, loser = null) => {
    const updated = cloneGame(nextGame);
    const changes = Object.fromEntries(updated.players.map((player) => [player.seat, 0]));
    if (mode === '自摸') {
      const winningPlayer = updated.players.find((player) => player.seat === winner.seat);
      updated.players.forEach((player) => {
        if (player.seat !== winningPlayer.seat) {
          player.score -= 10;
          changes[player.seat] -= 10;
          winningPlayer.score += 10;
          changes[winningPlayer.seat] += 10;
        }
      });
    } else if (loser) {
      const winningPlayer = updated.players.find((player) => player.seat === winner.seat);
      const losingPlayer = updated.players.find((player) => player.seat === loser.seat);
      const amount = Math.min(30, losingPlayer.score);
      losingPlayer.score -= amount;
      winningPlayer.score += amount;
      changes[losingPlayer.seat] -= amount;
      changes[winningPlayer.seat] += amount;
    }
    updated.status = mode === '流局' ? 'draw' : 'ended';
    updated.result = {
      winner: mode === '流局' ? null : updated.players.find((player) => player.seat === winner.seat).name,
      winnerSeat: mode === '流局' ? null : winner.seat,
      mode,
      loser: loser?.name || null,
      nextDealer: mode !== '流局' && winner.seat === '东'
        ? updated.dealerName
        : updated.players.find((player) => player.seat === '南').name,
      scoreChanges: changes,
      scores: Object.fromEntries(updated.players.map((player) => [player.name, player.score]))
    };
    updated.awaitingResponses = false;
    updated.pendingDiscard = null;
    setGame(updated);
    setSelectedTileId(null);
    setResponseDeadline(null);
    announceAction(mode === '流局' ? 'draw' : 'win',
      mode === '流局' ? '牌墙已空，本局流局' : `${winner.name} ${mode}！获得 ${changes[winner.seat]} 分`);
    setStatus(mode === '流局' ? '本局流局' : `${winner.name} ${mode}，本局结束`);
  };

  const resolvePendingResponses = (currentGame = game) => {
    if (!currentGame.pendingDiscard) return;
    const botClaim = findBotResponse(currentGame, playerName);
    setResponseDeadline(null);
    if (botClaim?.type === 'win') {
      const winner = currentGame.players.find((player) => player.seat === botClaim.player.seat);
      finishGame(currentGame, winner, '点炮',
        currentGame.players.find((player) => player.seat === currentGame.pendingDiscard.seat));
      return;
    }
    if (botClaim) {
      const nextGame = applyClaimToGame(currentGame, botClaim);
      if (nextGame.status === 'draw') {
        finishGame(nextGame, null, '流局');
        return;
      }
      setGame(nextGame);
      const actionName = { chi: '吃', pong: '碰', kong: '杠' }[botClaim.type];
      announceAction(botClaim.type, `${botClaim.player.name}${actionName}了 ${currentGame.pendingDiscard.tile.label}`, currentGame.pendingDiscard.tile);
      setStatus(`${botClaim.player.name}${actionName}牌，获得出牌权`);
      return;
    }
    const nextGame = cloneGame(currentGame);
    const discardSeatIndex = nextGame.players.findIndex((player) => player.seat === nextGame.pendingDiscard.seat);
    nextGame.currentSeat = nextGame.players[(discardSeatIndex + 1) % nextGame.players.length].seat;
    nextGame.pendingDiscard = null;
    nextGame.awaitingResponses = false;
    setGame(nextGame);
  };

  const rollDiceTogether = () => {
    if (!diceCeremony || diceCeremony.winner || diceCeremony.rolling) return;
    const rolls = diceCeremony.players
      .filter((player) => diceCeremony.contenders.includes(player.name))
      .map((player) => ({
        name: player.name,
        seat: player.seat,
        dice: Math.floor(Math.random() * 6) + 1,
        settled: false
      }));
    const ceremonyId = diceCeremony.id;
    const round = diceCeremony.round;
    const startedAt = performance.now();
    setDiceCeremony((current) => {
      if (!current || current.id !== ceremonyId || current.round !== round || current.rolling || current.winner) return current;
      return { ...current, rolling: true, startedAt, rolls };
    });
    window.setTimeout(() => {
      setDiceCeremony((latest) => {
        if (!latest || latest.id !== ceremonyId || latest.round !== round) return latest;
        return {
          ...latest,
          rolling: false,
          rolls: latest.rolls.map((entry) => ({ ...entry, settled: true }))
        };
      });
    }, 1800);
  };

  const compareDice = () => {
    setDiceCeremony((current) => {
      if (!current || current.winner || current.rolling ||
          current.rolls.length !== current.contenders.length || current.rolls.some((roll) => !roll.settled)) return current;
      const highest = Math.max(...current.rolls.map((roll) => roll.dice));
      const tied = current.rolls.filter((roll) => roll.dice === highest);
      const history = [...current.history, current.rolls];
      if (tied.length > 1) {
        return {
          ...current,
          round: current.round + 1,
          contenders: tied.map((roll) => roll.name),
          history,
          rolls: [],
          message: '最高点数并列，请并列玩家重新掷骰'
        };
      }
      return {
        ...current,
        history,
        winner: tied[0].name,
        message: `${tied[0].name}点数最高，担任庄家`
      };
    });
  };

  const startGameAfterDice = () => {
    if (!diceCeremony?.winner) return;
    const nextGame = dealInitialGame(playerName, tileSet, diceCeremony.winner);
    setGame(nextGame);
    setScreen('game');
    setStatus(`${diceCeremony.winner}掷骰点数最高，担任庄家`);
    setSelectedTileId(null);
    setActionEvent(null);
    setDiceCeremony(null);
  };

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      setStatus('已连接');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setStatus('未连接');
    });

    socket.on('room:state', (payload) => {
      setRoomInfo(payload);
      if (payload?.roomCode) {
        setStatus(`房间 ${payload.roomCode}`);
      }
    });

    socket.on('room:error', ({ message }) => {
      setStatus(message);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:state');
      socket.off('room:error');
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!game.awaitingResponses || !responseDeadline) return undefined;
    const updateCountdown = () => {
      setResponseSeconds(Math.max(0, Math.ceil((responseDeadline - Date.now()) / 1000)));
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 200);
    return () => window.clearInterval(interval);
  }, [game.awaitingResponses, responseDeadline]);

  useEffect(() => {
    if (screen !== 'game' || game.status !== 'playing') return undefined;

    if (game.awaitingResponses && game.pendingDiscard) {
      if (!responseDeadline) return undefined;
      if (!localCanRespond) {
        const timer = window.setTimeout(() => resolvePendingResponses(game), 650);
        return () => window.clearTimeout(timer);
      }
      const timer = window.setTimeout(
        () => resolvePendingResponses(game),
        Math.max(0, responseDeadline - Date.now())
      );
      return () => window.clearTimeout(timer);
    }

    const player = game.players.find((entry) => entry.seat === game.currentSeat);
    if (!player || player.name === playerName) return undefined;

    const timer = window.setTimeout(() => {
      const nextGame = cloneGame(game);
      const activePlayer = nextGame.players.find((entry) => entry.seat === game.currentSeat);
      if (activePlayer.hand.length === handSizeBeforeDraw(activePlayer)) {
        const tile = drawPlayableTile(nextGame.drawPile, activePlayer.flowers);
        if (!tile) {
          finishGame(nextGame, null, '流局');
          return;
        }
        activePlayer.hand.push(tile);
        activePlayer.drawnTileId = tile.id;
        setGame(nextGame);
        announceAction('draw', `${activePlayer.name}摸牌`, tile);
        setStatus(`${activePlayer.name}摸牌，正在思考出牌`);
        return;
      }

      if (isWinningHand(activePlayer.hand, activePlayer.melds.length)) {
        finishGame(nextGame, activePlayer, '自摸');
        return;
      }

      const discarded = getDiscardSuggestion(activePlayer.hand);
      if (!discarded) return;
      activePlayer.hand = activePlayer.hand.filter((tile) => tile.id !== discarded.id);
      activePlayer.drawnTileId = null;
      activePlayer.discard.push(discarded);
      nextGame.discardPile.push(discarded);
      nextGame.pendingDiscard = { tile: discarded, seat: activePlayer.seat };
      nextGame.awaitingResponses = true;
      setResponseDeadline(Date.now() + 10000);
      setResponseSeconds(10);
      setGame(nextGame);
      announceAction('discard', `${activePlayer.name}打出 ${discarded.label}`, discarded);
      setStatus(`${activePlayer.name}打出 ${discarded.label}，等待响应`);
    }, 1050);
    return () => window.clearTimeout(timer);
  }, [screen, game, playerName, canClaimWin, matchingPending.length, chiChoices.length, responseDeadline, localCanRespond]);

  const createRoom = () => {
    socket.emit('room:create', { playerName, roomName, password });
    setScreen('game');
  };

  const joinRoom = () => {
    socket.emit('room:join', { playerName, roomCode, password });
    setScreen('game');
  };

  const startPractice = () => {
    const name = playerName.trim() || '玩家';
    setPlayerName(name);
    const players = buildDemoPlayers(name);
    setDiceCeremony({
      id: Date.now() + Math.random(),
      playerName: name,
      players,
      round: 1,
      contenders: players.map((player) => player.name),
      rolls: [],
      history: [],
      winner: null,
      rolling: false,
      message: '按下按钮，让四位玩家同时掷骰'
    });
    setScreen('dice');
    setStatus('等待四名玩家手动掷骰');
    setSelectedTileId(null);
    setActionEvent(null);
    setResponseDeadline(null);
  };

  const startRoomGame = () => {
    socket.emit('game:start', { playerName });
    setStatus('房间游戏已开始');
    setScreen('game');
  };

  const drawTile = () => {
    if (!localPlayer || game.currentSeat !== localPlayer.seat || localHand.length !== handSizeBeforeDraw(localPlayer)) return;
    const nextGame = cloneGame(game);
    const player = nextGame.players.find((item) => item.seat === localPlayer.seat);
    const tile = drawPlayableTile(nextGame.drawPile, player.flowers);
    if (!tile) {
      finishGame(nextGame, null, '流局');
      return;
    }
    player.hand.push(tile);
    player.drawnTileId = tile.id;
    setGame(nextGame);
    announceAction('draw', `你摸到 ${tile.label}`, tile);
    setStatus(`你摸到 ${tile.label}，请选择一张牌打出`);
  };

  const discardSelectedTile = () => {
    if (!selectedTileId) {
      setStatus('请先选择一张牌');
      return;
    }

    if (!localPlayer || game.currentSeat !== localPlayer.seat || localHand.length !== handSizeBeforeDraw(localPlayer) + 1) {
      setStatus('摸牌后才能打出一张牌');
      return;
    }

    const nextGame = cloneGame(game);
    const player = nextGame.players.find((item) => item.name === playerName);
    const tileIndex = player.hand.findIndex((item) => item.id === selectedTileId);
    if (tileIndex < 0) {
      setStatus('所选麻将牌已不在手牌中');
      return;
    }
    const [tile] = player.hand.splice(tileIndex, 1);
    player.drawnTileId = null;
    const discardedLabel = tile.label;
    player.discard.push(tile);
    nextGame.discardPile.push(tile);
    nextGame.currentSeat = SEATS[(SEATS.indexOf(player.seat) + 1) % SEATS.length];
    nextGame.pendingDiscard = { tile, seat: player.seat };
    nextGame.awaitingResponses = true;
    setResponseDeadline(Date.now() + 10000);
    setResponseSeconds(10);
    setGame(nextGame);

    setSelectedTileId(null);
    announceAction('discard', `你打出 ${discardedLabel}`, tile);
    setStatus(`你打出 ${discardedLabel}，等待其他玩家响应`);
  };

  const resolveClaim = (type, chiChoice = chiChoices[0] || []) => {
    if (!pendingTile || !localPlayer || !game.pendingDiscard) return;
    if (type === 'win') {
      const nextGame = cloneGame(game);
      finishGame(nextGame, nextGame.players.find((player) => player.seat === localPlayer.seat), '点炮',
        nextGame.players.find((player) => player.seat === game.pendingDiscard.seat));
      return;
    }
    let matches = [];
    if (type === 'pong') matches = matchingPending.slice(0, 2);
    if (type === 'kong') matches = matchingPending.slice(0, 3);
    if (type === 'chi') matches = chiChoice;
    if ((type === 'pong' && matches.length < 2) || (type === 'kong' && matches.length < 3) || (type === 'chi' && matches.length < 2)) return;
    const nextGame = applyClaimToGame(game, { player: localPlayer, type, matches });
    if (nextGame.status === 'draw') {
      finishGame(nextGame, null, '流局');
      return;
    }
    setGame(nextGame);
    setResponseDeadline(null);
    setSelectedTileId(null);
    const actionName = { chi: '吃', pong: '碰', kong: '杠' }[type];
    announceAction(type, `你${actionName}了 ${pendingTile.label}`, pendingTile);
    setStatus(`你${actionName}牌成功，轮到你出牌`);
  };

  const passClaim = () => {
    if (!game.pendingDiscard) return;
    resolvePendingResponses(game);
    setStatus('你选择跳过，处理其他玩家的响应');
  };

  const claimSelfDraw = () => {
    if (!canSelfWin || !localPlayer) return;
    finishGame(game, localPlayer, '自摸');
  };

  const performSelfKong = (type, tile) => {
    if (!localPlayer || !tile || game.currentSeat !== localPlayer.seat || game.awaitingResponses) return;
    const expected = handSizeBeforeDraw(localPlayer);
    if (localHand.length !== expected + 1) {
      setStatus('摸牌后才能进行杠牌');
      return;
    }
    const nextGame = cloneGame(game);
    const player = nextGame.players.find((entry) => entry.seat === localPlayer.seat);
    if (type === 'concealed') {
      const four = player.hand.filter((item) => item.label === tile.label).slice(0, 4);
      if (four.length !== 4) return;
      const ids = new Set(four.map((item) => item.id));
      player.hand = player.hand.filter((item) => !ids.has(item.id));
      player.melds.push({ type: 'kong', tiles: four, concealed: true });
    } else {
      const held = player.hand.find((item) => item.label === tile.label);
      const pong = player.melds.find((meld) => meld.type === 'pong' && meld.tiles[0].label === tile.label);
      if (!held || !pong) return;
      player.hand = player.hand.filter((item) => item.id !== held.id);
      pong.type = 'kong';
      pong.tiles = [...pong.tiles, held];
      pong.concealed = false;
    }
    const supplement = drawReplacementTile(nextGame.drawPile, player.flowers);
    if (!supplement) {
      finishGame(nextGame, null, '流局');
      return;
    }
    player.hand.push(supplement);
    player.drawnTileId = supplement.id;
    setGame(nextGame);
    setSelectedTileId(null);
    announceAction('kong', `你${type === 'concealed' ? '暗杠' : '补杠'} ${tile.label}，补进一张牌`, tile);
    setStatus(`你完成${type === 'concealed' ? '暗杠' : '补杠'}，杠后补牌`);
  };

  const continueGame = () => {
    const nextGame = dealInitialGame(playerName, tileSet, game.result?.nextDealer);
    nextGame.round = (game.round || 1) + 1;
    nextGame.players.forEach((player) => {
      const previous = game.players.find((entry) => entry.name === player.name);
      if (previous) player.score = previous.score;
    });
    setGame(nextGame);
    setSelectedTileId(null);
    setStatus(`新一局开始，${nextGame.dealerName}担任庄家`);
  };

  const selectTileFromTable = (tileId) => {
    if (!localPlayer || game.status !== 'playing' || game.awaitingResponses || game.currentSeat !== localPlayer.seat) return;
    if (localHand.length !== handSizeBeforeDraw(localPlayer) + 1) {
      setStatus('先点击自己面前的牌墙摸一张牌');
      return;
    }
    setSelectedTileId((current) => current === tileId ? null : tileId);
  };

  const handleTableAction = (action) => {
    if (action === 'draw') drawTile();
    else if (action === 'discard') discardSelectedTile();
    else if (action === 'cancel') setSelectedTileId(null);
    else if (action === 'win') claimSelfDraw();
    else if (action === 'concealed-kong') performSelfKong('concealed', localHand.find((tile) => tile.label === concealedKongLabel));
    else if (action === 'added-kong') performSelfKong('added', addedKongTile);
  };

  const renderDiceCeremony = () => {
    if (!diceCeremony) return null;
    const currentComplete = diceCeremony.rolls.length === diceCeremony.contenders.length &&
      diceCeremony.rolls.every((roll) => roll.settled);
    const latestRoll = (name) => {
      const current = diceCeremony.rolls.find((roll) => roll.name === name);
      if (current) return current;
      for (let historyIndex = diceCeremony.history.length - 1; historyIndex >= 0; historyIndex -= 1) {
        const previous = diceCeremony.history[historyIndex].find((roll) => roll.name === name);
        if (previous) return previous;
      }
      return null;
    };
    const currentRoll = (name) => diceCeremony.rolls.find((roll) => roll.name === name);
    return (
      <main className="dice-screen">
        <Suspense fallback={<div className="table-loading">正在准备三维麻将桌…</div>}>
          <MahjongTable3D
            game={game}
            playerName={playerName}
            localHandGroups={[]}
            selectedTileId={null}
            suggestedTileId={null}
            actionEvent={null}
            canDraw={false}
            onSelectTile={() => {}}
            onDrawTile={() => {}}
            diceCeremony={diceCeremony}
          />
        </Suspense>
        <div className="dice-screen-shade" aria-hidden="true" />
        <div className="dice-screen-brand"><b>夯拉</b><span>麻将馆</span></div>
        <section className="dice-table-panel">
          <span className="dice-eyebrow">开局仪式 · 第 {diceCeremony.round} 轮</span>
          <h1>四家同时掷骰，点数最高者做庄</h1>
          <p className="dice-stage-help">
            {diceCeremony.winner
              ? `${diceCeremony.winner}点数最高，请确认后开始发牌。`
              : diceCeremony.rolling
                ? '四颗骰子正在桌面上滚动…'
                : diceCeremony.message}
          </p>
          <div className="dice-player-grid">
            {diceCeremony.players.map((player) => {
              const eligible = diceCeremony.contenders.includes(player.name);
              const roll = currentRoll(player.name) || latestRoll(player.name);
              const currentRoundRoll = currentRoll(player.name);
              return (
                <div className={`dice-player-card${eligible ? ' is-eligible' : ' is-out'}${currentRoundRoll?.settled ? ' has-rolled' : ''}`} key={player.name}>
                  <span className="dice-player-seat">{player.seat}家 · {player.name}</span>
                  <strong className="dice-player-result">
                    {currentRoundRoll?.settled
                      ? `本轮 ${currentRoundRoll.dice} 点`
                      : !eligible && roll
                        ? `已掷 ${roll.dice} 点`
                        : diceCeremony.rolling && eligible
                          ? '骰子滚动中…'
                          : '等待一起掷骰'}
                  </strong>
                  {!eligible && <small>点数已确定</small>}
                </div>
              );
            })}
          </div>
        </section>
        <div className="dice-round-actions">
          {diceCeremony.winner ? (
            <button className="main-button" onClick={startGameAfterDice}>确认庄家，开始发牌</button>
          ) : currentComplete ? (
            <button className="main-button" onClick={compareDice}>停止骰子并比较点数</button>
          ) : (
            <button className="main-button" disabled={diceCeremony.rolling} onClick={rollDiceTogether}>
              {diceCeremony.rolling
                ? '骰子滚动中…'
                : diceCeremony.round === 1
                  ? '四位玩家一起掷骰'
                  : `并列玩家一起重掷（${diceCeremony.contenders.length}人）`}
            </button>
          )}
          <button className="ghost-button" onClick={() => { setDiceCeremony(null); setScreen('home'); }}>返回首页</button>
        </div>
      </main>
    );
  };

  const renderHome = () => (
    <div className="home-shell">
      <div className="home-logo-wrap">
        <div className="home-logo">夯拉</div>
        <div className="home-name">麻将馆</div>
      </div>

      <div className="home-panel">
        <h1>来夯拉麻将馆，开一桌！</h1>
        <p>选择牌组，体验可自由旋转的三维麻将桌。</p>

        <div className="tile-version-control">
          <span>选择牌组</span>
          <div className="tile-version-options">
            <button
              className={tileSet === '136' ? 'version-option active' : 'version-option'}
              onClick={() => setTileSet('136')}
              type="button"
            >
              136 张 · 不含花牌
            </button>
            <button
              className={tileSet === '144' ? 'version-option active' : 'version-option'}
              onClick={() => setTileSet('144')}
              type="button"
            >
              144 张 · 含 8 张花牌
            </button>
          </div>
        </div>

        <button
          type="button"
          className="tutorial-switch"
          role="switch"
          aria-checked={tutorialMode}
          onClick={() => setTutorialMode((enabled) => !enabled)}
        >
          <span className="toggle-visual" aria-hidden="true" />
          <span>教程模式：出牌时提供建议</span>
        </button>

        <div className="home-actions">
          <button className="main-button" onClick={startPractice}>单机练习</button>
          <button className="main-button" onClick={() => setScreen('create-room')}>创建房间</button>
          <button className="main-button" onClick={() => setScreen('join-room')}>加入房间</button>
          <button className="ghost-button" onClick={() => setShowGuide(true)}>游戏规则</button>
        </div>

        <div className="home-form">
          <label>
            玩家名称
            <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
          </label>
        </div>
      </div>
    </div>
  );

  const renderCreateRoom = () => (
    <div className="modal-shell">
      <div className="modal-card">
        <div className="modal-header">
          <h2>创建房间</h2>
          <button onClick={() => setScreen('home')}>关闭</button>
        </div>

        <div className="field-group">
          <label>房间名称</label>
          <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
        </div>

        <div className="field-group">
          <label>房间密码</label>
          <input value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>

        <div className="modal-actions">
          <button className="main-button" onClick={createRoom}>创建</button>
        </div>
      </div>
    </div>
  );

  const renderJoinRoom = () => (
    <div className="modal-shell">
      <div className="modal-card">
        <div className="modal-header">
          <h2>加入房间</h2>
          <button onClick={() => setScreen('home')}>关闭</button>
        </div>

        <div className="field-group">
          <label>房间 ID</label>
          <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} />
        </div>

        <div className="field-group">
          <label>房间密码</label>
          <input value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>

        <div className="modal-actions">
          <button className="main-button" onClick={joinRoom}>加入</button>
        </div>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="game-shell">
      <header className="topbar">
        <div className="left-brand">
          <span className="mini-logo">夯拉</span>
          <span className="mini-name">麻将馆</span>
        </div>

        <div className="top-status">
          <div className="top-pill">东一局 · 第{game.round || 1}局</div>
          <div className="top-pill">{game.tileSet} 张牌</div>
          <div className="top-pill">牌墙：{game.drawPile.length} 张</div>
          <div className="top-pill">庄家：{game.dealerName}</div>
        </div>

        <div className="top-actions">
          <button className="soft-button" onClick={() => setShowGuide(true)}>游戏规则</button>
          <button className="soft-button" title="拖动旋转，滚轮或双指缩放">视角操作</button>
          <button className="soft-button" onClick={() => setSoundEnabled((enabled) => !enabled)}>
            {soundEnabled ? '音效：开' : '音效：关'}
          </button>
          <button className="soft-button" onClick={() => setScreen('home')}>返回首页</button>
        </div>
      </header>

      <div className="three-d-table-wrap">
        <Suspense fallback={<div className="table-loading">正在搭建三维麻将桌…</div>}>
          <MahjongTable3D
            game={game}
            playerName={playerName}
            localHandGroups={localHandGroups}
            selectedTileId={selectedTileId}
            suggestedTileId={suggestedTile?.id}
            actionEvent={actionEvent}
            canDraw={game.status === 'playing' && !game.awaitingResponses && game.currentSeat === localPlayer?.seat && localHand.length === handSizeBeforeDraw(localPlayer || { melds: [] })}
            onSelectTile={selectTileFromTable}
            onDrawTile={drawTile}
          />
        </Suspense>
        <div className="cloud-mist" aria-hidden="true" />
        <div className="table-seat-layer">
          {game.players.map((player, index) => {
            const localIndex = Math.max(0, game.players.findIndex((entry) => entry.name === playerName));
            const relativeSeat = (index - localIndex + 4) % 4;
            const positions = ['bottom', 'left', 'top', 'right'];
            const isMe = player.name === playerName;
            return (
              <div
                className={`seat-card seat-${positions[relativeSeat]} ${isMe ? 'is-me' : ''} ${game.currentSeat === player.seat ? 'is-current' : ''}`}
                key={player.seat}
              >
                <span>{player.seat}家{player.isDealer ? ' · 庄' : ''}</span>
                <strong>{player.name}{isMe ? '（你）' : ''}</strong>
                <small>
                  {player.hand.length + player.melds.length * 3} 张牌
                  {player.melds.length > 0 && ` · 暗手 ${player.hand.length} + 副露 ${player.melds.length} 组`}
                  {' · '}{player.score} 分
                </small>
              </div>
            );
          })}
        </div>
      </div>

      <div className="table-hint">
        {game.awaitingResponses
          ? '轮到你决定是否吃、碰、杠或胡'
          : game.currentSeat === localPlayer?.seat
            ? localHand.length === handSizeBeforeDraw(localPlayer) ? '轮到你摸牌' : '轮到你出牌'
            : `轮到${currentPlayer?.name || '玩家'}${currentPlayer?.seat || ''}家${currentPlayer && currentPlayer.hand.length === handSizeBeforeDraw(currentPlayer) ? '摸牌' : '出牌'}`}
        <span> · 拖动旋转 · 滚轮/双指缩放</span>
        {tutorialMode && suggestedTile && game.currentSeat === localPlayer?.seat && (
          <b className="tutorial-tip">建议考虑打出：{suggestedTile.label}</b>
        )}
      </div>

      <div className="bottom-controls">
        <div className="player-box">
          <span className="player-tag">{playerName}</span>
          <small>{localPlayer?.seat}家{localPlayer?.isDealer ? ' · 庄家' : ''}</small>
          <strong>{localPlayer?.score ?? 1000} 分</strong>
          {localPlayer?.flowers?.length > 0 && <small>花牌 {localPlayer.flowers.length} 张</small>}
        </div>
        {selectedTileId ? (
          <div className="turn-actions">
            <button className="main-button" onClick={discardSelectedTile}>打出</button>
            <button className="secondary-button" onClick={() => setSelectedTileId(null)}>取消</button>
          </div>
        ) : game.currentSeat === localPlayer?.seat ? (
          <div className="turn-actions">
            {canSelfWin && <button className="main-button" onClick={claimSelfDraw}>自摸</button>}
            {concealedKongLabel && localHand.length === handSizeBeforeDraw(localPlayer) + 1 && (
              <button className="secondary-button" onClick={() => performSelfKong('concealed', localHand.find((tile) => tile.label === concealedKongLabel))}>暗杠</button>
            )}
            {addedKongTile && localHand.length === handSizeBeforeDraw(localPlayer) + 1 && (
              <button className="secondary-button" onClick={() => performSelfKong('added', addedKongTile)}>补杠</button>
            )}
            <span className="turn-prompt">{localHand.length === handSizeBeforeDraw(localPlayer) ? '点击自己面前的牌墙摸牌' : '点击手牌选择要打出的牌'}</span>
          </div>
        ) : null}
      </div>

      {game.awaitingResponses && localPlayer && localCanRespond && (
        <div className="claim-actions" role="status" aria-live="polite">
          <strong className="response-countdown">轮到你决定 · {responseSeconds} 秒</strong>
          {canClaimWin && <button className="main-button" onClick={() => resolveClaim('win')}>胡牌</button>}
          {matchingPending.length >= 3 && <button className="secondary-button" onClick={() => resolveClaim('kong')}>杠牌</button>}
          {matchingPending.length >= 2 && <button className="secondary-button" onClick={() => resolveClaim('pong')}>碰牌</button>}
          {chiChoices.length > 0 && <button className="secondary-button" onClick={() => resolveClaim('chi', chiChoices[0])}>吃牌</button>}
          <button className="soft-button" onClick={passClaim}>跳过</button>
        </div>
      )}

      {actionEvent && (
        <div className={`action-banner action-${actionEvent.type}`} key={actionEvent.id} role="status">
          <span className="action-icon">{actionEvent.type === 'win' ? '✦' : actionEvent.type === 'draw' ? '摸' : actionEvent.type === 'discard' ? '打' : '牌'}</span>
          <strong>{actionEvent.message}</strong>
        </div>
      )}

      <div className="discard-box">
        {game.discardPile.length > 0 ? (
          <span>最近出牌：{game.discardPile[game.discardPile.length - 1].label}</span>
        ) : (
          <span>弃牌区为空</span>
        )}
      </div>

      <div className="status-box">
        <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
        {status}
      </div>

      {showGuide && (
        <div className="guide-modal" onClick={() => setShowGuide(false)}>
          <div className="guide-panel" onClick={(event) => event.stopPropagation()}>
            <div className="guide-header">
              <h2>麻将规则</h2>
              <button onClick={() => setShowGuide(false)}>×</button>
            </div>

            <div className="guide-content">
              <h3>一、基本规则</h3>
              <p>开局前可选择 136 张基础牌组（不含花牌）或 144 张牌组（含 8 张花牌）。四人各发 13 张，骰子点数最高者为庄家并额外发 1 张，共 14 张。</p>

              <h3>二、吃碰杠胡</h3>
              <p>吃牌需为连续顺子，碰牌需为两张同牌加一张同牌，杠牌需为四张相同牌，胡牌为四面子加一对子。</p>

              <h3>三、顺序</h3>
              <p>普通玩家轮到时先摸 1 张，再打出 1 张；庄家开局已有 14 张，第一轮直接打牌，不额外摸牌。144 张牌组摸到花牌后会补牌。</p>

              <h3>四、庄家轮换</h3>
              <p>开局四名玩家同时掷骰，点数最高者担任东家庄家；若最高点数并列，只有并列玩家重新掷骰，直到决出庄家。</p>
            </div>
          </div>
        </div>
      )}

      {(game.status === 'ended' || game.status === 'draw') && game.result && (
        <div className="result-overlay">
          <section className="result-card" role="dialog" aria-modal="true" aria-labelledby="result-title">
            <div className="result-emblem">{game.result.mode === '流局' ? '和' : '胡'}</div>
            <p className="result-eyebrow">本局结算</p>
            <h2 id="result-title">{game.result.mode === '流局' ? '流局' : `${game.result.winner} · ${game.result.mode}`}</h2>
            {game.result.winner && <p className="result-score">本局赢得 <strong>+{game.result.scoreChanges[game.result.winnerSeat]}</strong> 分</p>}
            <div className="result-score-list">
              {game.players.map((player) => (
                <div className="result-score-row" key={player.seat}>
                  <span>{player.seat}家 · {player.name}</span>
                  <strong className={(game.result.scoreChanges[player.seat] || 0) > 0 ? 'score-up' : ''}>
                    {(game.result.scoreChanges[player.seat] || 0) > 0 ? '+' : ''}{game.result.scoreChanges[player.seat] || 0}
                  </strong>
                  <small>{player.score} 分</small>
                </div>
              ))}
            </div>
            <p className="next-dealer">下一局庄家：{game.result.nextDealer}</p>
            <p className="score-note">练习计分：自摸每位对手 10 分；点炮由放铳玩家支付 30 分。</p>
            <div className="result-actions">
              <button className="main-button" onClick={continueGame}>继续下一局</button>
              <button className="ghost-button" onClick={() => setScreen('home')}>退出游戏</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );

  return (
    <div className="app-root">
      {screen === 'home' && renderHome()}
      {screen === 'create-room' && renderCreateRoom()}
      {screen === 'join-room' && renderJoinRoom()}
      {screen === 'dice' && renderDiceCeremony()}
      {screen === 'game' && renderGame()}
    </div>
  );
}

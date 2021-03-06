import { Socket } from 'socket.io';
import { rooms, userToRoom } from '../database';
import { Role, Room } from '../database/types';
import { dayTime, nightTime } from './config';
import { sample } from 'lodash';

export function handleVote(socket: Socket): void {
  socket.on('vote', (votedPlayer: string) => {
    // if no votedPlayer, directly return
    if (!votedPlayer) {
      return;
    }

    console.log(`received a new vote request!`);
    console.log(`player socketId: ${socket.id}`);
    const roomId = userToRoom.get(socket.id) as string;
    console.log(`roomId: ${roomId}`);
    const room = rooms[roomId] as Room;
    room.votes.push(votedPlayer);
  });
}

export function handleStart(socket: Socket): void {
  socket.on('start', () => {
    const roomId = userToRoom.get(socket.id) as string;
    const room = rooms[roomId] as Room;
    // tell all players that the game has started
    for (const { socketId } of Object.values(room.players)) {
      socket.to(socketId).emit('start');
      socket.to(socketId).emit('day');
    }
    socket.emit('start');
    socket.emit('day');
    setTimeout(() => dayCallback(roomId, socket), dayTime);
  });
}

export function handleKill(socket: Socket): void {
  socket.on('kill', (killedPlayer: string) => {
    if (!killedPlayer) {
      return;
    }
    const roomId = userToRoom.get(socket.id) as string;
    const room = rooms[roomId] as Room;
    room.killedPlayers.push(killedPlayer);
  });
}

/**
 * Callback for when the day phase has finished.
 * @param roomId
 * @param socket
 */
function dayCallback(roomId: string, socket: Socket): void {
  // end the loop if room no longer exists
  if (!rooms[roomId]) return;

  const room = rooms[roomId] as Room;

  // get the voted player
  const votedPlayer = determineVotedPlayer(roomId);

  if (!room) {
    return;
  }

  if (votedPlayer) {
    room.players[votedPlayer].isOut = true;
    for (const { socketId } of Object.values(room.players)) {
      // tell the player who is voted to be kicked out
      socket.to(socketId).emit('voted player', votedPlayer);
    }
    socket.emit('voted player', votedPlayer);
  }

  // check whether the game as ended and notify players the winner
  if (checkIfGameHasEnded(roomId)) {
    const winner = computeGameWinner(roomId);
    for (const { socketId } of Object.values(room.players)) {
      socket.to(socketId).emit('game ended', winner);
    }
    socket.emit('game ended', winner);
  }

  // switch to night phase
  for (const { socketId } of Object.values(room.players)) {
    socket.to(socketId).emit('night');
  }
  socket.emit('night');

  // schedule the night callback
  setTimeout(() => nightCallback(roomId, socket), nightTime);
}

/**
 * Callback for when the night phase has finished.
 * @param roomId
 * @param socket
 */
function nightCallback(roomId: string, socket: Socket): void {
  // end the loop if room no longer exists
  if (!rooms[roomId]) return;

  const room = rooms[roomId] as Room;

  // check whether the game as ended and notify players the winner
  if (checkIfGameHasEnded(roomId)) {
    const winner = computeGameWinner(roomId);
    for (const { socketId } of Object.values(room.players)) {
      socket.to(socketId).emit('game ended', winner);
    }
    socket.emit('game ended', winner);
  }

  for (const { socketId } of Object.values(room.players)) {
    // tell the player to switch to day phase
    socket.to(socketId).emit('day');
    socket.to(socketId).emit('killed players', room.killedPlayers);
  }
  // tell the player to switch to day phase
  socket.emit('day');
  socket.emit('killed players', room.killedPlayers);

  // schedule the day callback
  setTimeout(() => dayCallback(roomId, socket), dayTime);
}

/**
 * Function to determine which role is going to be killed.
 * @param roomId
 */
function determineVotedPlayer(roomId: string): string {
  const room = rooms[roomId] as Room;
  const votes = room.votes;
  let playerNum = 0;

  for (const player of Object.values(room.players)) {
    if (!player.isOut) {
      playerNum++;
    }
  }

  const voteCount: { [index: string]: number } = {};
  let max = 0;

  for (const player of votes) {
    if (!voteCount[player]) {
      voteCount[player] = 0;
    }
    voteCount[player]++;
    if (voteCount[player] > max) {
      max = voteCount[player];
    }
  }

  const candidates = [];
  for (const [player, count] of Object.entries(voteCount)) {
    if (count === max && count >= 0.5 * playerNum) {
      candidates.push(player);
    }
  }

  const result = candidates.length === 0 ? '' : (sample(candidates) as string);

  // clear votes for the next round
  room.votes = [];

  return result;
}

/**
 * Check if a game has ended. The game ends if it matches any of the following cases:
 * 1. No mafia.
 * 2. Mafia has >= 0.5 of the whole population.
 * @param roomId
 */
function checkIfGameHasEnded(roomId: string): boolean {
  const players = (rooms[roomId] as Room).players;
  let mafiaCount = 0;
  let wholePopulation = 0;
  for (const { role, isOut } of Object.values(players)) {
    if (isOut) {
      continue;
    }
    if (role === Role.mafia) {
      mafiaCount++;
    }
    wholePopulation++;
  }
  return mafiaCount === 0 || mafiaCount >= Math.floor(wholePopulation / 2);
}

function computeGameWinner(roomId: string): string {
  const players = (rooms[roomId] as Room).players;
  let mafiaCount = 0;
  for (const { role, isOut } of Object.values(players)) {
    if (isOut) {
      continue;
    }
    if (role === Role.mafia) {
      mafiaCount++;
    }
  }
  if (mafiaCount === 0) {
    return 'villager';
  } else {
    return 'mafia';
  }
}

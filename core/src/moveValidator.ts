import { type BoardState, type Move, type GameState, type Piece } from "./types";

function isInsideBoard(x: number, y: number): boolean {
  return x >= 0 && x < 9 && y >= 0 && y < 9;
}

function isPathClear(board: BoardState, move: Move): boolean {
  const dx = move.to.x - move.from.x;
  const dy = move.to.y - move.from.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const steps = Math.max(Math.abs(dx), Math.abs(dy));

  for (let i = 1; i < steps; i += 1) {
    const x = move.from.x + stepX * i;
    const y = move.from.y + stepY * i;
    if (board[y][x]) {
      return false;
    }
  }

  return true;
}

function isGoldLikeMove(piece: Piece, move: Move): boolean {
  const dx = move.to.x - move.from.x;
  const dy = move.to.y - move.from.y;
  const forward = piece.color === "black" ? -dy : dy;

  if (forward === 1 && Math.abs(dx) <= 1) {
    return true;
  }

  if (forward === 0 && Math.abs(dx) === 1) {
    return true;
  }

  return forward === -1 && dx === 0;
}

function isKingMove(move: Move): boolean {
  const dx = Math.abs(move.to.x - move.from.x);
  const dy = Math.abs(move.to.y - move.from.y);
  return dx <= 1 && dy <= 1;
}

function isRookMove(move: Move): boolean {
  const dx = Math.abs(move.to.x - move.from.x);
  const dy = Math.abs(move.to.y - move.from.y);
  return (dx === 0 || dy === 0) && !(dx === 0 && dy === 0);
}

function isBishopMove(move: Move): boolean {
  const dx = Math.abs(move.to.x - move.from.x);
  const dy = Math.abs(move.to.y - move.from.y);
  return dx === dy && dx !== 0;
}

function isPieceMovePatternLegal(state: GameState, piece: Piece, move: Move): boolean {
  const dx = move.to.x - move.from.x;
  const dy = move.to.y - move.from.y;
  const forward = piece.color === "black" ? -dy : dy;

  if (piece.promoted && (piece.kind === "pawn" || piece.kind === "lance" || piece.kind === "knight" || piece.kind === "silver")) {
    return isGoldLikeMove(piece, move);
  }

  if (piece.kind === "king") {
    return isKingMove(move);
  }

  if (piece.kind === "gold") {
    return isGoldLikeMove(piece, move);
  }

  if (piece.kind === "silver") {
    if (forward === 1 && Math.abs(dx) <= 1) {
      return true;
    }
    return forward === -1 && Math.abs(dx) === 1;
  }

  if (piece.kind === "knight") {
    return forward === 2 && Math.abs(dx) === 1;
  }

  if (piece.kind === "pawn") {
    return dx === 0 && forward === 1;
  }

  if (piece.kind === "lance") {
    return dx === 0 && forward > 0 && isPathClear(state.board, move);
  }

  if (piece.kind === "rook") {
    if (isRookMove(move) && isPathClear(state.board, move)) {
      return true;
    }
    return piece.promoted && Math.abs(dx) === 1 && Math.abs(dy) === 1;
  }

  if (piece.kind === "bishop") {
    if (isBishopMove(move) && isPathClear(state.board, move)) {
      return true;
    }

    if (!piece.promoted) {
      return false;
    }

    return (Math.abs(dx) === 1 && dy === 0) || (Math.abs(dy) === 1 && dx === 0);
  }

  return false;
}

export function isMoveLegal(state: GameState, move: Move): boolean {
  if (!isInsideBoard(move.from.x, move.from.y) || !isInsideBoard(move.to.x, move.to.y)) {
    return false;
  }

  if (move.from.x === move.to.x && move.from.y === move.to.y) {
    return false;
  }

  const piece = state.board[move.from.y]?.[move.from.x];
  if (!piece) {
    return false;
  }

  if (piece.color !== state.turn) {
    return false;
  }

  const target = state.board[move.to.y]?.[move.to.x];
  if (target?.color === piece.color) {
    return false;
  }

  return isPieceMovePatternLegal(state, piece, move);
}

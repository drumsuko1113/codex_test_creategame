import { HAND_PIECE_KINDS } from "./constants";
import { isInsideBoard } from "./board";
import { type BoardMove, type BoardState, type Move, type GameState, type Piece } from "./types";

function isDropMove(move: Move): move is { to: { x: number; y: number }; drop: Piece["kind"] } {
  return "drop" in move;
}

function isPathClear(board: BoardState, move: BoardMove): boolean {
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

function isGoldLikeMove(piece: Piece, move: BoardMove): boolean {
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

function isKingMove(move: BoardMove): boolean {
  const dx = Math.abs(move.to.x - move.from.x);
  const dy = Math.abs(move.to.y - move.from.y);
  return dx <= 1 && dy <= 1;
}

function isRookMove(move: BoardMove): boolean {
  const dx = Math.abs(move.to.x - move.from.x);
  const dy = Math.abs(move.to.y - move.from.y);
  return (dx === 0 || dy === 0) && !(dx === 0 && dy === 0);
}

function isBishopMove(move: BoardMove): boolean {
  const dx = Math.abs(move.to.x - move.from.x);
  const dy = Math.abs(move.to.y - move.from.y);
  return dx === dy && dx !== 0;
}

function isPieceMovePatternLegal(state: GameState, piece: Piece, move: BoardMove): boolean {
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

function hasUnpromotedPawnInFile(state: GameState, fileX: number): boolean {
  for (const row of state.board) {
    const piece = row[fileX];
    if (piece?.kind === "pawn" && piece.color === state.turn && !piece.promoted) {
      return true;
    }
  }
  return false;
}

function canDropOnRank(pieceKind: Piece["kind"], color: GameState["turn"], y: number): boolean {
  if (pieceKind === "pawn" || pieceKind === "lance") {
    return color === "black" ? y > 0 : y < 8;
  }

  if (pieceKind === "knight") {
    return color === "black" ? y > 1 : y < 7;
  }

  return true;
}

function isDropLegal(state: GameState, move: Extract<Move, { drop: Piece["kind"] }>): boolean {
  if (!isInsideBoard(move.to.x, move.to.y)) {
    return false;
  }

  if (!HAND_PIECE_KINDS.includes(move.drop)) {
    return false;
  }

  if (state.board[move.to.y][move.to.x]) {
    return false;
  }

  const handCount = state.hands[state.turn][move.drop] ?? 0;
  if (handCount <= 0) {
    return false;
  }

  if (!canDropOnRank(move.drop, state.turn, move.to.y)) {
    return false;
  }

  if (move.drop === "pawn" && hasUnpromotedPawnInFile(state, move.to.x)) {
    return false;
  }

  return true;
}

export function isMoveLegal(state: GameState, move: Move): boolean {
  if (isDropMove(move)) {
    return isDropLegal(state, move);
  }

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

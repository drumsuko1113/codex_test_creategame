import { isInsideBoard } from "./board";
import { HAND_PIECE_KINDS } from "./constants";
import { isDropMove } from "./move";
import { forwardDistance, isInLastRanks } from "./orientation";
import { type BoardMove, type BoardState, type GameState, type Move, type Piece } from "./types";

const GOLD_LIKE_PROMOTED_PIECES: Piece["kind"][] = ["pawn", "lance", "knight", "silver"];

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

function isGoldLikeMove(forward: number, dx: number): boolean {
  if (forward === 1 && Math.abs(dx) <= 1) {
    return true;
  }

  if (forward === 0 && Math.abs(dx) === 1) {
    return true;
  }

  return forward === -1 && dx === 0;
}

function isKingMove(dx: number, dy: number): boolean {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  return absDx <= 1 && absDy <= 1;
}

function isRookMove(dx: number, dy: number): boolean {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  return (absDx === 0 || absDy === 0) && !(absDx === 0 && absDy === 0);
}

function isBishopMove(dx: number, dy: number): boolean {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  return absDx === absDy && absDx !== 0;
}

function isPieceMovePatternLegal(state: GameState, piece: Piece, move: BoardMove): boolean {
  const dx = move.to.x - move.from.x;
  const dy = move.to.y - move.from.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const forward = forwardDistance(piece.color, move.from.y, move.to.y);

  if (piece.promoted && GOLD_LIKE_PROMOTED_PIECES.includes(piece.kind)) {
    return isGoldLikeMove(forward, dx);
  }

  switch (piece.kind) {
    case "king":
      return isKingMove(dx, dy);
    case "gold":
      return isGoldLikeMove(forward, dx);
    case "silver":
      if (forward === 1 && absDx <= 1) {
        return true;
      }
      return forward === -1 && absDx === 1;
    case "knight":
      return forward === 2 && absDx === 1;
    case "pawn":
      return dx === 0 && forward === 1;
    case "lance":
      return dx === 0 && forward > 0 && isPathClear(state.board, move);
    case "rook":
      if (isRookMove(dx, dy) && isPathClear(state.board, move)) {
        return true;
      }
      return piece.promoted && absDx === 1 && absDy === 1;
    case "bishop":
      if (isBishopMove(dx, dy) && isPathClear(state.board, move)) {
        return true;
      }
      if (!piece.promoted) {
        return false;
      }
      return (absDx === 1 && dy === 0) || (absDy === 1 && dx === 0);
    default:
      return false;
  }
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
    return !isInLastRanks(color, y, 1);
  }

  if (pieceKind === "knight") {
    return !isInLastRanks(color, y, 2);
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

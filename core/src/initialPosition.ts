import { BOARD_SIZE } from "./constants";
import { type BoardState, type GameState, type Piece } from "./types";

function piece(kind: Piece["kind"], color: Piece["color"]): Piece {
  return { kind, color, promoted: false };
}

function emptyBoard(): BoardState {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

export function createInitialGameState(): GameState {
  const board = emptyBoard();

  board[0] = [
    piece("lance", "white"),
    piece("knight", "white"),
    piece("silver", "white"),
    piece("gold", "white"),
    piece("king", "white"),
    piece("gold", "white"),
    piece("silver", "white"),
    piece("knight", "white"),
    piece("lance", "white"),
  ];

  board[1][1] = piece("rook", "white");
  board[1][7] = piece("bishop", "white");

  for (let x = 0; x < BOARD_SIZE; x += 1) {
    board[2][x] = piece("pawn", "white");
    board[6][x] = piece("pawn", "black");
  }

  board[7][1] = piece("bishop", "black");
  board[7][7] = piece("rook", "black");

  board[8] = [
    piece("lance", "black"),
    piece("knight", "black"),
    piece("silver", "black"),
    piece("gold", "black"),
    piece("king", "black"),
    piece("gold", "black"),
    piece("silver", "black"),
    piece("knight", "black"),
    piece("lance", "black"),
  ];

  return {
    board,
    hands: { black: {}, white: {} },
    turn: "black",
  };
}

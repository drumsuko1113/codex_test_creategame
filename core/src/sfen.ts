import { type Color, type GameState, type Piece, type PieceKind } from "./types";

const KIND_TO_SFEN: Record<PieceKind, string> = {
  king: "K",
  rook: "R",
  bishop: "B",
  gold: "G",
  silver: "S",
  knight: "N",
  lance: "L",
  pawn: "P",
};

const SFEN_TO_KIND: Record<string, PieceKind> = {
  K: "king",
  R: "rook",
  B: "bishop",
  G: "gold",
  S: "silver",
  N: "knight",
  L: "lance",
  P: "pawn",
};

const HAND_ORDER: PieceKind[] = ["rook", "bishop", "gold", "silver", "knight", "lance", "pawn"];

function serializePiece(piece: Piece): string {
  const base = KIND_TO_SFEN[piece.kind];
  const letter = piece.color === "black" ? base : base.toLowerCase();
  return piece.promoted ? `+${letter}` : letter;
}

function deserializePiece(token: string): Piece {
  const promoted = token.startsWith("+");
  const base = promoted ? token.slice(1) : token;
  const upper = base.toUpperCase();
  const kind = SFEN_TO_KIND[upper];

  if (!kind) {
    throw new Error(`Invalid SFEN piece token: ${token}`);
  }

  return {
    kind,
    color: base === upper ? "black" : "white",
    promoted,
  };
}

function serializeBoard(state: GameState): string {
  return state.board
    .map((row) => {
      let line = "";
      let emptyCount = 0;

      for (const cell of row) {
        if (!cell) {
          emptyCount += 1;
          continue;
        }

        if (emptyCount > 0) {
          line += String(emptyCount);
          emptyCount = 0;
        }

        line += serializePiece(cell);
      }

      if (emptyCount > 0) {
        line += String(emptyCount);
      }

      return line;
    })
    .join("/");
}

function parseBoard(boardSfen: string): GameState["board"] {
  const ranks = boardSfen.split("/");
  if (ranks.length !== 9) {
    throw new Error("Invalid SFEN board: expected 9 ranks");
  }

  return ranks.map((rank) => {
    const row: Array<Piece | null> = [];

    for (let i = 0; i < rank.length; i += 1) {
      const ch = rank[i];

      if (/\d/.test(ch)) {
        const count = Number(ch);
        for (let n = 0; n < count; n += 1) {
          row.push(null);
        }
        continue;
      }

      if (ch === "+") {
        const pieceToken = `+${rank[i + 1]}`;
        row.push(deserializePiece(pieceToken));
        i += 1;
        continue;
      }

      row.push(deserializePiece(ch));
    }

    if (row.length !== 9) {
      throw new Error("Invalid SFEN board: each rank must have 9 files");
    }

    return row;
  });
}

function serializeHands(state: GameState): string {
  const tokens: string[] = [];

  for (const kind of HAND_ORDER) {
    const count = state.hands.black[kind] ?? 0;
    if (count > 0) {
      tokens.push(`${count > 1 ? count : ""}${KIND_TO_SFEN[kind]}`);
    }
  }

  for (const kind of HAND_ORDER) {
    const count = state.hands.white[kind] ?? 0;
    if (count > 0) {
      const lower = KIND_TO_SFEN[kind].toLowerCase();
      tokens.push(`${count > 1 ? count : ""}${lower}`);
    }
  }

  return tokens.length > 0 ? tokens.join("") : "-";
}

function parseHands(handsSfen: string): GameState["hands"] {
  const hands: GameState["hands"] = { black: {}, white: {} };

  if (handsSfen === "-") {
    return hands;
  }

  let i = 0;
  while (i < handsSfen.length) {
    let countText = "";
    while (i < handsSfen.length && /\d/.test(handsSfen[i])) {
      countText += handsSfen[i];
      i += 1;
    }

    if (i >= handsSfen.length) {
      throw new Error("Invalid SFEN hands: missing piece token");
    }

    const token = handsSfen[i];
    const kind = SFEN_TO_KIND[token.toUpperCase()];
    if (!kind) {
      throw new Error(`Invalid SFEN hand piece token: ${token}`);
    }

    const color: Color = token === token.toUpperCase() ? "black" : "white";
    const count = countText ? Number(countText) : 1;
    hands[color][kind] = (hands[color][kind] ?? 0) + count;
    i += 1;
  }

  return hands;
}

export function gameStateToSfen(state: GameState): string {
  const board = serializeBoard(state);
  const turn = state.turn === "black" ? "b" : "w";
  const hands = serializeHands(state);
  return `${board} ${turn} ${hands} 1`;
}

export function sfenToGameState(sfen: string): GameState {
  const parts = sfen.trim().split(/\s+/);
  if (parts.length < 3) {
    throw new Error("Invalid SFEN: expected at least board, turn, hands");
  }

  const board = parseBoard(parts[0]);
  const turn = parts[1] === "b" ? "black" : parts[1] === "w" ? "white" : null;
  if (!turn) {
    throw new Error("Invalid SFEN turn token");
  }

  const hands = parseHands(parts[2]);

  return {
    board,
    turn,
    hands,
  };
}

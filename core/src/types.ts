export type Color = "black" | "white";

export type PieceKind =
  | "king"
  | "rook"
  | "bishop"
  | "gold"
  | "silver"
  | "knight"
  | "lance"
  | "pawn";

export type Piece = {
  kind: PieceKind;
  color: Color;
  promoted: boolean;
};

export type Position = {
  x: number;
  y: number;
};

export type BoardState = Array<Array<Piece | null>>;

export type HandState = Record<Color, Partial<Record<PieceKind, number>>>;

export type GameState = {
  board: BoardState;
  hands: HandState;
  turn: Color;
};

export type Move = {
  from: Position;
  to: Position;
  promote?: boolean;
};

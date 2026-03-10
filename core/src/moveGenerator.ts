import { forEachBoardPosition, isInsideBoard } from "./board";
import { isInCheck } from "./check";
import { HAND_PIECE_KINDS } from "./constants";
import { tryApplyMove } from "./moveExecutor";
import { canChoosePromotion, shouldAutoPromote } from "./promotion";
import { type BoardMove, type Color, type GameState, type Move, type Piece, type Position } from "./types";

type Delta = {
  dx: number;
  dy: number;
};

function forwardDelta(color: Color): number {
  return color === "black" ? -1 : 1;
}

function isGoldLikePiece(piece: Piece): boolean {
  return (
    piece.kind === "gold"
    || (
      piece.promoted
      && (
        piece.kind === "pawn"
        || piece.kind === "lance"
        || piece.kind === "knight"
        || piece.kind === "silver"
      )
    )
  );
}

function goldMoveDeltas(color: Color): readonly Delta[] {
  const forward = forwardDelta(color);
  return [
    { dx: 0, dy: forward },
    { dx: -1, dy: forward },
    { dx: 1, dy: forward },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -forward },
  ];
}

function silverMoveDeltas(color: Color): readonly Delta[] {
  const forward = forwardDelta(color);
  return [
    { dx: 0, dy: forward },
    { dx: -1, dy: forward },
    { dx: 1, dy: forward },
    { dx: -1, dy: -forward },
    { dx: 1, dy: -forward },
  ];
}

function knightMoveDeltas(color: Color): readonly Delta[] {
  const forward = forwardDelta(color);
  return [
    { dx: -1, dy: forward * 2 },
    { dx: 1, dy: forward * 2 },
  ];
}

function addStepTargets(
  state: GameState,
  from: Position,
  color: Color,
  deltas: readonly Delta[],
  targets: Position[],
): void {
  for (const { dx, dy } of deltas) {
    const x = from.x + dx;
    const y = from.y + dy;
    if (!isInsideBoard(x, y)) {
      continue;
    }

    const occupant = state.board[y][x];
    if (occupant?.color === color) {
      continue;
    }

    targets.push({ x, y });
  }
}

function addRayTargets(
  state: GameState,
  from: Position,
  color: Color,
  deltas: readonly Delta[],
  targets: Position[],
): void {
  for (const { dx, dy } of deltas) {
    let x = from.x + dx;
    let y = from.y + dy;

    while (isInsideBoard(x, y)) {
      const occupant = state.board[y][x];
      if (!occupant) {
        targets.push({ x, y });
        x += dx;
        y += dy;
        continue;
      }

      if (occupant.color !== color) {
        targets.push({ x, y });
      }
      break;
    }
  }
}

function collectBoardMoveTargets(state: GameState, from: Position): Position[] {
  const piece = state.board[from.y]?.[from.x];
  if (!piece || piece.color !== state.turn) {
    return [];
  }

  const targets: Position[] = [];
  if (isGoldLikePiece(piece)) {
    addStepTargets(state, from, piece.color, goldMoveDeltas(piece.color), targets);
    return targets;
  }

  switch (piece.kind) {
    case "king":
      addStepTargets(
        state,
        from,
        piece.color,
        [
          { dx: -1, dy: -1 },
          { dx: 0, dy: -1 },
          { dx: 1, dy: -1 },
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: -1, dy: 1 },
          { dx: 0, dy: 1 },
          { dx: 1, dy: 1 },
        ],
        targets,
      );
      return targets;
    case "silver":
      addStepTargets(state, from, piece.color, silverMoveDeltas(piece.color), targets);
      return targets;
    case "knight":
      addStepTargets(state, from, piece.color, knightMoveDeltas(piece.color), targets);
      return targets;
    case "pawn":
      addStepTargets(state, from, piece.color, [{ dx: 0, dy: forwardDelta(piece.color) }], targets);
      return targets;
    case "lance":
      addRayTargets(state, from, piece.color, [{ dx: 0, dy: forwardDelta(piece.color) }], targets);
      return targets;
    case "rook":
      addRayTargets(
        state,
        from,
        piece.color,
        [
          { dx: 0, dy: -1 },
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: 1 },
        ],
        targets,
      );
      if (piece.promoted) {
        addStepTargets(
          state,
          from,
          piece.color,
          [
            { dx: -1, dy: -1 },
            { dx: 1, dy: -1 },
            { dx: -1, dy: 1 },
            { dx: 1, dy: 1 },
          ],
          targets,
        );
      }
      return targets;
    case "bishop":
      addRayTargets(
        state,
        from,
        piece.color,
        [
          { dx: -1, dy: -1 },
          { dx: 1, dy: -1 },
          { dx: -1, dy: 1 },
          { dx: 1, dy: 1 },
        ],
        targets,
      );
      if (piece.promoted) {
        addStepTargets(
          state,
          from,
          piece.color,
          [
            { dx: 0, dy: -1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
          ],
          targets,
        );
      }
      return targets;
    case "gold":
      addStepTargets(state, from, piece.color, goldMoveDeltas(piece.color), targets);
      return targets;
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

function canDropOnRank(pieceKind: Piece["kind"], color: Color, y: number): boolean {
  if (pieceKind === "pawn" || pieceKind === "lance") {
    return color === "black" ? y > 0 : y < 8;
  }

  if (pieceKind === "knight") {
    return color === "black" ? y > 1 : y < 7;
  }

  return true;
}

function isPawnDrop(move: Move): move is Extract<Move, { drop: Piece["kind"] }> {
  return "drop" in move && move.drop === "pawn";
}

function visitCandidateMoves(
  state: GameState,
  from: Position,
  visitor: (move: Move) => void | false,
  excludePawnDropMate: boolean,
): boolean {
  const piece = state.board[from.y]?.[from.x];
  if (!piece || piece.color !== state.turn) {
    return true;
  }

  for (const to of collectBoardMoveTargets(state, from)) {
    const baseMove: BoardMove = { from, to };
    if (visitMoveIfApplicable(state, baseMove, visitor, excludePawnDropMate) === false) {
      return false;
    }

    if (!piece.promoted && canChoosePromotion(piece, baseMove) && !shouldAutoPromote(piece, baseMove)) {
      const promoteMove: BoardMove = { ...baseMove, promote: true };
      if (visitMoveIfApplicable(state, promoteMove, visitor, excludePawnDropMate) === false) {
        return false;
      }
    }
  }

  return true;
}

function isPseudoCheckmate(state: GameState): boolean {
  return isInCheck(state) && !hasAnyPseudoLegalMove(state);
}

function isGeneratedMoveLegal(state: GameState, move: Move, excludePawnDropMate: boolean): boolean {
  const result = tryApplyMove(state, move);
  if (!result.ok) {
    return false;
  }

  if (excludePawnDropMate && isPawnDrop(move) && isPseudoCheckmate(result.value)) {
    return false;
  }

  return true;
}

function visitMoveIfApplicable(
  state: GameState,
  move: Move,
  visitor: (move: Move) => void | false,
  excludePawnDropMate: boolean,
): void | false {
  if (!isGeneratedMoveLegal(state, move, excludePawnDropMate)) {
    return;
  }

  return visitor(move);
}

function visitLegalBoardMoves(
  state: GameState,
  from: Position,
  visitor: (move: Move) => void | false,
  excludePawnDropMate: boolean,
): boolean {
  return visitCandidateMoves(state, from, visitor, excludePawnDropMate);
}

function visitLegalDropMoves(
  state: GameState,
  visitor: (move: Move) => void | false,
  excludePawnDropMate: boolean,
): boolean {
  const hand = state.hands[state.turn];
  let completed = true;

  for (const kind of HAND_PIECE_KINDS) {
    if ((hand[kind] ?? 0) <= 0) {
      continue;
    }

    forEachBoardPosition(({ x, y }) => {
      if (state.board[y][x]) {
        return;
      }
      if (!canDropOnRank(kind, state.turn, y)) {
        return;
      }
      if (kind === "pawn" && hasUnpromotedPawnInFile(state, x)) {
        return;
      }

      const move: Move = {
        drop: kind,
        to: { x, y },
      };

      if (visitMoveIfApplicable(state, move, visitor, excludePawnDropMate) === false) {
        completed = false;
        return false;
      }
    });

    if (!completed) {
      return false;
    }
  }

  return true;
}

function visitLegalMoves(
  state: GameState,
  visitor: (move: Move) => void | false,
  excludePawnDropMate: boolean,
): boolean {
  let completed = true;

  forEachBoardPosition((position) => {
    const piece = state.board[position.y][position.x];
    if (!piece || piece.color !== state.turn) {
      return;
    }

    if (!visitLegalBoardMoves(state, position, visitor, excludePawnDropMate)) {
      completed = false;
      return false;
    }
  });

  if (!completed) {
    return false;
  }

  return visitLegalDropMoves(state, visitor, excludePawnDropMate);
}

export function generateLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  visitLegalMoves(state, (move) => {
    moves.push(move);
  }, true);
  return moves;
}

export function generatePseudoLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  visitLegalMoves(state, (move) => {
    moves.push(move);
  }, false);
  return moves;
}

export function hasAnyLegalMove(state: GameState): boolean {
  let found = false;
  visitLegalMoves(state, () => {
    found = true;
    return false;
  }, true);
  return found;
}

export function hasAnyPseudoLegalMove(state: GameState): boolean {
  let found = false;
  visitLegalMoves(state, () => {
    found = true;
    return false;
  }, false);
  return found;
}

export function generateLegalTargets(state: GameState, from: Position): Position[] {
  const targets: Position[] = [];
  const piece = state.board[from.y]?.[from.x];
  if (!piece || piece.color !== state.turn) {
    return targets;
  }

  for (const to of collectBoardMoveTargets(state, from)) {
    const baseMove: BoardMove = { from, to };
    const canMoveNormally = isGeneratedMoveLegal(state, baseMove, true);
    const canMoveWithPromotion = !piece.promoted
      && canChoosePromotion(piece, baseMove)
      && !shouldAutoPromote(piece, baseMove)
      && isGeneratedMoveLegal(state, { ...baseMove, promote: true }, true);

    if (canMoveNormally || canMoveWithPromotion) {
      targets.push(to);
    }
  }

  return targets;
}

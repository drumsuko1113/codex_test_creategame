import { canChoosePromotion, shouldAutoPromote } from "../../../core/src/promotion";
import { type BoardMove, type Color, type GameState, type Piece, type PieceKind, type Position } from "../../../core/src/types";
import { isSamePosition } from "./position";

const PIECE_LABEL: Record<PieceKind, string> = {
  king: "玉",
  rook: "飛",
  bishop: "角",
  gold: "金",
  silver: "銀",
  knight: "桂",
  lance: "香",
  pawn: "歩",
};

const PROMOTED_PIECE_LABEL: Partial<Record<PieceKind, string>> = {
  rook: "龍",
  bishop: "馬",
  silver: "全",
  knight: "圭",
  lance: "杏",
  pawn: "と",
};

const FILE_LABEL = ["９", "８", "７", "６", "５", "４", "３", "２", "１"];
const RANK_LABEL = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

export function oppositeColor(color: Color): Color {
  return color === "black" ? "white" : "black";
}

export function sideLabel(color: Color): string {
  return color === "black" ? "▲" : "△";
}

export function winnerLabel(color: Color): string {
  return color === "black" ? "先手" : "後手";
}

function positionToKifu(position: Position): string {
  return `${FILE_LABEL[position.x]}${RANK_LABEL[position.y]}`;
}

function positionToSource(position: Position): string {
  const file = 9 - position.x;
  const rank = position.y + 1;
  return `(${file}${rank})`;
}

function pieceLabel(piece: Piece): string {
  if (piece.promoted && PROMOTED_PIECE_LABEL[piece.kind]) {
    return PROMOTED_PIECE_LABEL[piece.kind] as string;
  }
  return PIECE_LABEL[piece.kind];
}

export function formatMoveText(
  stateBefore: GameState,
  move: BoardMove | { drop: PieceKind; to: Position },
  previousTo: Position | null,
): string {
  const mover = sideLabel(stateBefore.turn);
  const destination = previousTo && isSamePosition(previousTo, move.to) ? "同" : positionToKifu(move.to);

  if ("drop" in move) {
    return `${mover}${destination}${PIECE_LABEL[move.drop]}打`;
  }

  const piece = stateBefore.board[move.from.y][move.from.x];
  if (!piece) {
    return `${mover}${destination}駒`;
  }

  const label = pieceLabel(piece);
  const baseMove: BoardMove = { from: move.from, to: move.to };
  const promotionAvailable = canChoosePromotion(piece, baseMove);
  const forcedPromotion = shouldAutoPromote(piece, baseMove);

  let promotionSuffix = "";
  if (!piece.promoted) {
    if (move.promote || forcedPromotion) {
      promotionSuffix = "成";
    } else if (promotionAvailable) {
      promotionSuffix = "不成";
    }
  }

  return `${mover}${destination}${label}${promotionSuffix}${positionToSource(move.from)}`;
}

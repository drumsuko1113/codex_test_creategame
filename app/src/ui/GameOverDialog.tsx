import { type Color } from "../../../core/src/types";

type GameOverDialogProps = {
  isOpen: boolean;
  winner: Color | null;
  onRestart: () => void;
  onClose: () => void;
};

export function GameOverDialog({ isOpen, winner, onRestart, onClose }: GameOverDialogProps) {
  if (!isOpen || !winner) {
    return null;
  }

  const winnerLabel = winner === "black" ? "先手" : "後手";

  return (
    <div className="gameover-dialog-backdrop" role="presentation">
      <div className="gameover-dialog" role="dialog" aria-modal="true" aria-label="Game over">
        <p className="gameover-title">{winnerLabel}の勝ちです</p>
        <p className="gameover-text">次の対局を始めますか？</p>
        <div className="gameover-actions">
          <button type="button" onClick={onRestart}>
            はい
          </button>
          <button type="button" onClick={onClose}>
            いいえ
          </button>
        </div>
      </div>
    </div>
  );
}

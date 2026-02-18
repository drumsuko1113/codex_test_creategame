import { type Color } from "../../../core/src/types";

type GameOverDialogProps = {
  isOpen: boolean;
  title: string;
  winner: Color | null;
  onRestart: () => void;
  onClose: () => void;
};

export function GameOverDialog({ isOpen, title, winner, onRestart, onClose }: GameOverDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="gameover-dialog-backdrop" role="presentation">
      <div className="gameover-dialog" role="dialog" aria-modal="true" aria-label="Game over">
        <p className="gameover-title">{title}</p>
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

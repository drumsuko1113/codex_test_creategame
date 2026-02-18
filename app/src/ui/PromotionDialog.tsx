type PromotionDialogProps = {
  isOpen: boolean;
  onChoose: (promote: boolean) => void;
};

export function PromotionDialog({ isOpen, onChoose }: PromotionDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="promotion-dialog-backdrop" role="presentation">
      <div className="promotion-dialog" role="dialog" aria-modal="true" aria-label="Promotion choice">
        <p className="promotion-title">成りますか？</p>
        <div className="promotion-actions">
          <button type="button" onClick={() => onChoose(true)}>
            成る
          </button>
          <button type="button" onClick={() => onChoose(false)}>
            成らない
          </button>
        </div>
      </div>
    </div>
  );
}

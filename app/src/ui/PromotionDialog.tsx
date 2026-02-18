type PromotionDialogProps = {
  isOpen: boolean;
};

export function PromotionDialog({ isOpen }: PromotionDialogProps) {
  if (!isOpen) {
    return null;
  }

  return <div>Promotion (planned)</div>;
}

import { useEffect } from "react";
import { applyMove } from "../../../core/src/applyMove";
import { generateLegalMoves } from "../../../core/src/moveGenerator";
import type { Color, GameState, Move } from "../../../core/src/types";
import { chooseRandomMove } from "../../../bot/src/randomBot";
import { isBotTurn } from "../game/botMode";

type UseBotTurnParams = {
  screenMode: "setup" | "game";
  matchMode: "online" | "bot";
  gameOver: boolean;
  isPaused: boolean;
  pendingPromotion: unknown | null;
  isSubmittingMove: boolean;
  isSubmittingResign: boolean;
  isSyncingSnapshot: boolean;
  botSeat: Color;
  state: GameState;
  appendMoveHistory: (move: Move) => void;
  playPieceSound: () => void;
  resolveBotMatchOutcome: (state: GameState) => boolean;
  setState: (state: GameState) => void;
  setGameVersion: (updater: (current: number) => number) => void;
  setGameMessage: (message: string | null) => void;
  setGameOver: (gameOver: boolean) => void;
  setShowRestartDialog: (show: boolean) => void;
  setWinner: (winner: Color | null) => void;
  setResultText: (text: string | null) => void;
  latestVersionRef: React.MutableRefObject<number>;
};

export function useBotTurn(params: UseBotTurnParams): void {
  const {
    screenMode,
    matchMode,
    gameOver,
    isPaused,
    pendingPromotion,
    isSubmittingMove,
    isSubmittingResign,
    isSyncingSnapshot,
    botSeat,
    state,
    appendMoveHistory,
    playPieceSound,
    resolveBotMatchOutcome,
    setState,
    setGameVersion,
    setGameMessage,
    setGameOver,
    setShowRestartDialog,
    setWinner,
    setResultText,
    latestVersionRef,
  } = params;

  useEffect(() => {
    if (
      screenMode !== "game"
      || matchMode !== "bot"
      || gameOver
      || isPaused
      || pendingPromotion !== null
      || isSubmittingMove
      || isSubmittingResign
      || isSyncingSnapshot
      || !isBotTurn(botSeat, state.turn)
    ) {
      return;
    }

    const timerId = window.setTimeout(() => {
      let selectedMove = chooseRandomMove(state);
      if (selectedMove) {
        const result = applyMove(state, selectedMove);
        if (!result.ok) {
          selectedMove = generateLegalMoves(state).find((candidate) => applyMove(state, candidate).ok) ?? null;
        }
      }

      if (!selectedMove) {
        resolveBotMatchOutcome(state);
        return;
      }

      const applied = applyMove(state, selectedMove);
      if (!applied.ok) {
        setGameMessage("ボットの着手生成に失敗しました。");
        return;
      }

      appendMoveHistory(selectedMove);
      playPieceSound();
      setState(applied.value);
      setGameVersion((current) => {
        const next = current + 1;
        latestVersionRef.current = next;
        return next;
      });
      setGameMessage(null);

      const ended = resolveBotMatchOutcome(applied.value);
      if (!ended) {
        setGameOver(false);
        setShowRestartDialog(false);
        setWinner(null);
        setResultText(null);
      }
    }, 350);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    screenMode,
    matchMode,
    gameOver,
    isPaused,
    pendingPromotion,
    isSubmittingMove,
    isSubmittingResign,
    isSyncingSnapshot,
    botSeat,
    state,
    appendMoveHistory,
    playPieceSound,
    resolveBotMatchOutcome,
    setState,
    setGameVersion,
    setGameMessage,
    setGameOver,
    setShowRestartDialog,
    setWinner,
    setResultText,
    latestVersionRef,
  ]);
}

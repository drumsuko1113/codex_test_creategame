import type { Color } from "../../../core/src/types";

type SetupScreenProps = {
  startingTurn: Color;
  mainMinutes: number;
  byoSeconds: number;
  onStartingTurnChange: (turn: Color) => void;
  onMainMinutesChange: (value: string) => void;
  onByoSecondsChange: (value: string) => void;
  onStart: () => void;
};

export function SetupScreen({
  startingTurn,
  mainMinutes,
  byoSeconds,
  onStartingTurnChange,
  onMainMinutesChange,
  onByoSecondsChange,
  onStart,
}: SetupScreenProps) {
  return (
    <main className="app">
      <h1>Shogi Game</h1>
      <section className="start-screen" aria-label="match setup">
        <h2>対局設定</h2>
        <div className="setup-row">
          <span className="setup-label">開始手番</span>
          <div className="setup-options">
            <button
              type="button"
              className={`setup-button ${startingTurn === "black" ? "is-selected" : ""}`.trim()}
              onClick={() => onStartingTurnChange("black")}
            >
              先手
            </button>
            <button
              type="button"
              className={`setup-button ${startingTurn === "white" ? "is-selected" : ""}`.trim()}
              onClick={() => onStartingTurnChange("white")}
            >
              後手
            </button>
          </div>
        </div>
        <div className="setup-row">
          <span className="setup-label">持ち時間</span>
          <div className="setup-input-grid">
            <label className="setup-input-label" htmlFor="main-minutes-input">
              持ち時間（分）
            </label>
            <input
              id="main-minutes-input"
              className="setup-number-input"
              type="number"
              min={0}
              step={1}
              value={mainMinutes}
              onChange={(event) => onMainMinutesChange(event.target.value)}
            />
            <label className="setup-input-label" htmlFor="byo-seconds-input">
              秒読み（秒）
            </label>
            <input
              id="byo-seconds-input"
              className="setup-number-input"
              type="number"
              min={0}
              step={10}
              value={byoSeconds}
              onChange={(event) => onByoSecondsChange(event.target.value)}
            />
          </div>
        </div>
        <button type="button" className="start-match-button" onClick={onStart}>
          対局開始
        </button>
      </section>
    </main>
  );
}

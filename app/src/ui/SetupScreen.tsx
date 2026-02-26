import type { Color } from "../../../core/src/types";

type SetupMatchMode = "online" | "bot";

type SetupScreenProps = {
  setupMode: SetupMatchMode;
  createMainMinutes: string;
  createByoSeconds: string;
  joinGameId: string;
  spectateGameId: string;
  joinToken: string;
  joinName: string;
  joinSeat: Color;
  createErrors: string[];
  joinErrors: string[];
  spectateErrors: string[];
  createMessage: string | null;
  joinMessage: string | null;
  spectateMessage: string | null;
  botMessage: string | null;
  spectatorUrl: string | null;
  isCreating: boolean;
  isJoining: boolean;
  isStartingSpectate: boolean;
  isStartingBot: boolean;
  botName: string;
  botSeat: Color;
  onSetupModeChange: (mode: SetupMatchMode) => void;
  onCreateMainMinutesChange: (value: string) => void;
  onCreateByoSecondsChange: (value: string) => void;
  onJoinGameIdChange: (value: string) => void;
  onSpectateGameIdChange: (value: string) => void;
  onJoinTokenChange: (value: string) => void;
  onJoinNameChange: (value: string) => void;
  onJoinSeatChange: (seat: Color) => void;
  onBotNameChange: (value: string) => void;
  onBotSeatChange: (seat: Color) => void;
  onBotStart: () => void;
  onCreateSubmit: () => void;
  onJoinSubmit: () => void;
  onSpectateSubmit: () => void;
};

export function SetupScreen({
  setupMode,
  createMainMinutes,
  createByoSeconds,
  joinGameId,
  spectateGameId,
  joinToken,
  joinName,
  joinSeat,
  createErrors,
  joinErrors,
  spectateErrors,
  createMessage,
  joinMessage,
  spectateMessage,
  botMessage,
  spectatorUrl,
  isCreating,
  isJoining,
  isStartingSpectate,
  isStartingBot,
  botName,
  botSeat,
  onSetupModeChange,
  onCreateMainMinutesChange,
  onCreateByoSecondsChange,
  onJoinGameIdChange,
  onSpectateGameIdChange,
  onJoinTokenChange,
  onJoinNameChange,
  onJoinSeatChange,
  onBotNameChange,
  onBotSeatChange,
  onBotStart,
  onCreateSubmit,
  onJoinSubmit,
  onSpectateSubmit,
}: SetupScreenProps) {
  return (
    <main className="app">
      <h1>Shogi Game</h1>
      <section className="start-screen" aria-label="match setup">
        <h2>{setupMode === "online" ? "オンライン対局の作成 / 参加" : "Bot対戦を開始"}</h2>
        <div className="setup-options" aria-label="match mode toggle">
          <button
            type="button"
            className={`setup-button ${setupMode === "online" ? "is-selected" : ""}`.trim()}
            onClick={() => onSetupModeChange("online")}
          >
            オンライン
          </button>
          <button
            type="button"
            className={`setup-button ${setupMode === "bot" ? "is-selected" : ""}`.trim()}
            onClick={() => onSetupModeChange("bot")}
          >
            Bot対戦
          </button>
        </div>

        {setupMode === "online" ? (
          <div className="lobby-columns">
            <section className="lobby-card" aria-label="create game form">
              <h3>対局を作成</h3>
              <div className="setup-input-grid">
                <label className="setup-input-label" htmlFor="create-main-minutes-input">
                  持ち時間 (分)
                </label>
                <input
                  id="create-main-minutes-input"
                  className="setup-number-input"
                  type="number"
                  min={1}
                  step={1}
                  value={createMainMinutes}
                  onChange={(event) => onCreateMainMinutesChange(event.target.value)}
                />
                <label className="setup-input-label" htmlFor="create-byo-seconds-input">
                  秒読み (秒)
                </label>
                <input
                  id="create-byo-seconds-input"
                  className="setup-number-input"
                  type="number"
                  min={0}
                  step={10}
                  value={createByoSeconds}
                  onChange={(event) => onCreateByoSecondsChange(event.target.value)}
                />
              </div>
              {createErrors.length > 0 ? (
                <ul className="form-error-list" aria-label="create validation errors">
                  {createErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              ) : null}
              {createMessage ? <p className="form-message">{createMessage}</p> : null}
              <button type="button" className="start-match-button" onClick={onCreateSubmit} disabled={isCreating}>
                {isCreating ? "作成中..." : "対局を作成"}
              </button>
            </section>

            <section className="lobby-card" aria-label="join game form">
              <h3>対局に参加</h3>
              <div className="setup-input-grid">
                <label className="setup-input-label" htmlFor="join-game-id-input">
                  gameId
                </label>
                <input
                  id="join-game-id-input"
                  className="setup-number-input"
                  type="text"
                  value={joinGameId}
                  onChange={(event) => onJoinGameIdChange(event.target.value)}
                />
                <label className="setup-input-label" htmlFor="join-token-input">
                  joinToken
                </label>
                <input
                  id="join-token-input"
                  className="setup-number-input"
                  type="text"
                  value={joinToken}
                  onChange={(event) => onJoinTokenChange(event.target.value)}
                />
                <label className="setup-input-label" htmlFor="join-name-input">
                  表示名
                </label>
                <input
                  id="join-name-input"
                  className="setup-number-input"
                  type="text"
                  value={joinName}
                  onChange={(event) => onJoinNameChange(event.target.value)}
                />
                <span className="setup-input-label">席</span>
                <div className="setup-options">
                  <button
                    type="button"
                    className={`setup-button ${joinSeat === "black" ? "is-selected" : ""}`.trim()}
                    onClick={() => onJoinSeatChange("black")}
                  >
                    先手
                  </button>
                  <button
                    type="button"
                    className={`setup-button ${joinSeat === "white" ? "is-selected" : ""}`.trim()}
                    onClick={() => onJoinSeatChange("white")}
                  >
                    後手
                  </button>
                </div>
              </div>
              {joinErrors.length > 0 ? (
                <ul className="form-error-list" aria-label="join validation errors">
                  {joinErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              ) : null}
              {joinMessage ? <p className="form-message">{joinMessage}</p> : null}
              <button type="button" className="start-match-button" onClick={onJoinSubmit} disabled={isJoining}>
                {isJoining ? "参加中..." : "対局に参加"}
              </button>
            </section>

            <section className="lobby-card" aria-label="spectate game form">
              <h3>観戦する</h3>
              <div className="setup-input-grid">
                <label className="setup-input-label" htmlFor="spectate-game-id-input">
                  gameId
                </label>
                <input
                  id="spectate-game-id-input"
                  className="setup-number-input"
                  type="text"
                  value={spectateGameId}
                  onChange={(event) => onSpectateGameIdChange(event.target.value)}
                />
              </div>
              {spectateErrors.length > 0 ? (
                <ul className="form-error-list" aria-label="spectate validation errors">
                  {spectateErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              ) : null}
              {spectateMessage ? <p className="form-message">{spectateMessage}</p> : null}
              {spectatorUrl ? <p className="form-message">観戦URL: {spectatorUrl}</p> : null}
              <button
                type="button"
                className="start-match-button"
                onClick={onSpectateSubmit}
                disabled={isStartingSpectate}
              >
                {isStartingSpectate ? "接続中..." : "観戦を開始"}
              </button>
            </section>
          </div>
        ) : (
          <section className="lobby-card" aria-label="bot game form">
            <h3>人間 vs Bot</h3>
            <div className="setup-input-grid">
              <label className="setup-input-label" htmlFor="bot-name-input">
                表示名
              </label>
              <input
                id="bot-name-input"
                className="setup-number-input"
                type="text"
                value={botName}
                onChange={(event) => onBotNameChange(event.target.value)}
              />
              <span className="setup-input-label">あなたの席</span>
              <div className="setup-options">
                <button
                  type="button"
                  className={`setup-button ${botSeat === "black" ? "is-selected" : ""}`.trim()}
                  onClick={() => onBotSeatChange("black")}
                >
                  先手
                </button>
                <button
                  type="button"
                  className={`setup-button ${botSeat === "white" ? "is-selected" : ""}`.trim()}
                  onClick={() => onBotSeatChange("white")}
                >
                  後手
                </button>
              </div>
            </div>
            {botMessage ? <p className="form-message">{botMessage}</p> : null}
            <button type="button" className="start-match-button" onClick={onBotStart} disabled={isStartingBot}>
              {isStartingBot ? "開始中..." : "Bot対戦を開始"}
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

import type { Color } from "../../../core/src/types";

type SetupMatchMode = "online" | "bot";

type SetupScreenProps = {
  setupMode: SetupMatchMode;
  passphrase: string;
  spectateGameId: string;
  joinName: string;
  joinErrors: string[];
  spectateErrors: string[];
  joinMessage: string | null;
  spectateMessage: string | null;
  botMessage: string | null;
  spectatorUrl: string | null;
  isJoining: boolean;
  isStartingSpectate: boolean;
  isStartingBot: boolean;
  botName: string;
  botSeat: Color;
  onSetupModeChange: (mode: SetupMatchMode) => void;
  onPassphraseChange: (value: string) => void;
  onSpectateGameIdChange: (value: string) => void;
  onJoinNameChange: (value: string) => void;
  onBotNameChange: (value: string) => void;
  onBotSeatChange: (seat: Color) => void;
  onBotStart: () => void;
  onJoinSubmit: () => void;
  onSpectateSubmit: () => void;
};

export function SetupScreen({
  setupMode,
  passphrase,
  spectateGameId,
  joinName,
  joinErrors,
  spectateErrors,
  joinMessage,
  spectateMessage,
  botMessage,
  spectatorUrl,
  isJoining,
  isStartingSpectate,
  isStartingBot,
  botName,
  botSeat,
  onSetupModeChange,
  onPassphraseChange,
  onSpectateGameIdChange,
  onJoinNameChange,
  onBotNameChange,
  onBotSeatChange,
  onBotStart,
  onJoinSubmit,
  onSpectateSubmit,
}: SetupScreenProps) {
  return (
    <main className="app">
      <h1>Shogi Game</h1>
      <section className="start-screen" aria-label="match setup">
        <h2>{setupMode === "online" ? "オンライン対局" : "Bot対局"}</h2>
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
            Bot対局
          </button>
        </div>

        {setupMode === "online" ? (
          <div className="lobby-columns">
            <section className="lobby-card" aria-label="match by passphrase form">
              <h3>合言葉マッチング</h3>
              <div className="setup-input-grid">
                <label className="setup-input-label" htmlFor="match-passphrase-input">
                  合言葉
                </label>
                <input
                  id="match-passphrase-input"
                  className="setup-number-input"
                  type="text"
                  maxLength={8}
                  value={passphrase}
                  onChange={(event) => onPassphraseChange(event.target.value)}
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
                {isJoining ? "接続中..." : "マッチング開始"}
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
                {isStartingSpectate ? "開始中..." : "観戦を開始"}
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
                  black
                </button>
                <button
                  type="button"
                  className={`setup-button ${botSeat === "white" ? "is-selected" : ""}`.trim()}
                  onClick={() => onBotSeatChange("white")}
                >
                  white
                </button>
              </div>
            </div>
            {botMessage ? <p className="form-message">{botMessage}</p> : null}
            <button type="button" className="start-match-button" onClick={onBotStart} disabled={isStartingBot}>
              {isStartingBot ? "開始中..." : "Bot対局を開始"}
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

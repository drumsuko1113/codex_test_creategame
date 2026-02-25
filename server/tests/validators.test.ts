import { describe, expect, test } from "vitest";
import { isMoveRequestBody, isValidCreateGameInput, isValidJoinGameInput } from "../src/validators";

describe("validators", () => {
  describe("isValidCreateGameInput", () => {
    test("accepts integer values within allowed range", () => {
      expect(isValidCreateGameInput({ mainMinutes: 1, byoSeconds: 0 })).toBe(true);
      expect(isValidCreateGameInput({ mainMinutes: 10, byoSeconds: 30 })).toBe(true);
    });

    test("rejects invalid mainMinutes and byoSeconds", () => {
      expect(isValidCreateGameInput(null)).toBe(false);
      expect(isValidCreateGameInput({ mainMinutes: 0, byoSeconds: 30 })).toBe(false);
      expect(isValidCreateGameInput({ mainMinutes: 5.5, byoSeconds: 30 })).toBe(false);
      expect(isValidCreateGameInput({ mainMinutes: 5, byoSeconds: -1 })).toBe(false);
      expect(isValidCreateGameInput({ mainMinutes: 5, byoSeconds: 15 })).toBe(false);
    });
  });

  describe("isValidJoinGameInput", () => {
    test("accepts a trimmed name, seat, and join token", () => {
      expect(
        isValidJoinGameInput({
          name: "  player  ",
          seat: "black",
          joinToken: "a".repeat(16),
        }),
      ).toBe(true);
    });

    test("rejects invalid name / seat / join token", () => {
      expect(isValidJoinGameInput({ name: "a", seat: "black", joinToken: "a".repeat(16) })).toBe(false);
      expect(isValidJoinGameInput({ name: " ".repeat(3), seat: "black", joinToken: "a".repeat(16) })).toBe(false);
      expect(isValidJoinGameInput({ name: "a".repeat(21), seat: "black", joinToken: "a".repeat(16) })).toBe(false);
      expect(isValidJoinGameInput({ name: "player", seat: "blue", joinToken: "a".repeat(16) })).toBe(false);
      expect(isValidJoinGameInput({ name: "player", seat: "white", joinToken: "short" })).toBe(false);
    });
  });

  describe("isMoveRequestBody", () => {
    test("accepts board move and drop move payloads", () => {
      expect(
        isMoveRequestBody({
          expectedVersion: 3,
          move: { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } },
        }),
      ).toBe(true);

      expect(
        isMoveRequestBody({
          expectedVersion: 3,
          move: { from: { x: 1, y: 6 }, to: { x: 1, y: 5 }, promote: false },
        }),
      ).toBe(true);

      expect(
        isMoveRequestBody({
          expectedVersion: 2,
          move: { drop: "pawn", to: { x: 4, y: 4 } },
        }),
      ).toBe(true);
    });

    test("rejects invalid versions and move shapes", () => {
      expect(
        isMoveRequestBody({
          expectedVersion: 0,
          move: { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } },
        }),
      ).toBe(false);

      expect(
        isMoveRequestBody({
          expectedVersion: 1.1,
          move: { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } },
        }),
      ).toBe(false);

      expect(
        isMoveRequestBody({
          expectedVersion: 2,
          move: { from: { x: -1, y: 6 }, to: { x: 0, y: 5 } },
        }),
      ).toBe(false);

      expect(
        isMoveRequestBody({
          expectedVersion: 2,
          move: { from: { x: 0, y: 6 }, to: { x: 0, y: 5 }, promote: "yes" },
        }),
      ).toBe(false);

      expect(
        isMoveRequestBody({
          expectedVersion: 2,
          move: { drop: "king", to: { x: 4, y: 4 } },
        }),
      ).toBe(false);
    });
  });
});

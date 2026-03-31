import { randomUUID } from "node:crypto";
import type { Seat } from "./types";

export function createJoinToken(): string {
  return randomUUID().replaceAll("-", "");
}

export function pickAvailableSeat(seats: readonly Seat[]): Seat | null {
  if (!seats.includes("black")) {
    return "black";
  }
  if (!seats.includes("white")) {
    return "white";
  }
  return null;
}

export function pickRandomSeat(): Seat {
  return Math.random() < 0.5 ? "black" : "white";
}

export function pickLobbySeat(seats: readonly Seat[]): Seat | null {
  if (seats.length === 0) {
    return pickRandomSeat();
  }
  return pickAvailableSeat(seats);
}

export function oppositeSeat(seat: Seat): Seat {
  return seat === "black" ? "white" : "black";
}

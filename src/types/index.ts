import { Race, Pick, Score, User, RaceResult } from "@prisma/client";

export type { Race, Pick, Score, User, RaceResult };

export type LeaderboardEntry = {
  userId: string;
  name: string;
  totalPoints: number;
  pickCount: number;
};

export type RaceWithResult = Race & {
  result: RaceResult | null;
};

export type PickWithRace = Pick & {
  race: Race;
  score: Score | null;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
};

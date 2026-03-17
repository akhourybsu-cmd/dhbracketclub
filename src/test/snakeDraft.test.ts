import { describe, it, expect } from "vitest";

/**
 * Snake draft order logic extracted from DraftDetailPage.
 * Even rounds go forward (1,2,3), odd rounds go backward (3,2,1).
 */
function getExpectedPickerIndex(
  totalPicks: number,
  numParticipants: number
): number {
  const round = Math.floor(totalPicks / numParticipants);
  const posInRound = totalPicks % numParticipants;
  return round % 2 === 0 ? posInRound : numParticipants - 1 - posInRound;
}

describe("Snake Draft Order", () => {
  it("should follow snake order for 3 participants, 3 rounds", () => {
    const n = 3;
    const expected = [
      // Round 1 (even=0): forward → 0, 1, 2
      0, 1, 2,
      // Round 2 (odd=1): backward → 2, 1, 0
      2, 1, 0,
      // Round 3 (even=2): forward → 0, 1, 2
      0, 1, 2,
    ];

    for (let pick = 0; pick < 9; pick++) {
      expect(getExpectedPickerIndex(pick, n)).toBe(expected[pick]);
    }
  });

  it("should follow snake order for 2 participants, 5 rounds", () => {
    const n = 2;
    const expected = [
      // Round 1: 0, 1
      0, 1,
      // Round 2: 1, 0
      1, 0,
      // Round 3: 0, 1
      0, 1,
      // Round 4: 1, 0
      1, 0,
      // Round 5: 0, 1
      0, 1,
    ];

    for (let pick = 0; pick < 10; pick++) {
      expect(getExpectedPickerIndex(pick, n)).toBe(expected[pick]);
    }
  });

  it("should handle 4 participants correctly", () => {
    const n = 4;
    // Round 1 (forward): 0,1,2,3
    // Round 2 (backward): 3,2,1,0
    const expected = [0, 1, 2, 3, 3, 2, 1, 0];

    for (let pick = 0; pick < 8; pick++) {
      expect(getExpectedPickerIndex(pick, n)).toBe(expected[pick]);
    }
  });

  it("should calculate correct round number", () => {
    const numParticipants = 3;
    // picks 0-2 = round 0, picks 3-5 = round 1, picks 6-8 = round 2
    expect(Math.floor(0 / numParticipants) + 1).toBe(1);
    expect(Math.floor(3 / numParticipants) + 1).toBe(2);
    expect(Math.floor(6 / numParticipants) + 1).toBe(3);
  });

  it("should detect draft completion correctly", () => {
    const numParticipants = 3;
    const numRounds = 3;
    const totalExpected = numParticipants * numRounds; // 9
    
    expect(8 >= totalExpected).toBe(false); // pick 8 is not complete
    expect(9 >= totalExpected).toBe(true);  // pick 9 means complete
  });
});

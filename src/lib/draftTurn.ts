type DraftTurnParticipant = {
  user_id: string;
  pick_order: number;
  profiles?: {
    display_name: string;
  } | null;
};

type DraftTurnState = {
  status?: string;
  num_rounds: number;
  current_pick_user_id?: string | null;
  current_pick_number?: number | null;
  current_round?: number | null;
  current_pick_profiles?: {
    display_name: string;
  } | null;
};

export function getDerivedDraftTurn<T extends DraftTurnState>(
  draft: T,
  participants: DraftTurnParticipant[],
  totalPicks: number
) {
  const sortedParticipants = [...participants].sort((a, b) => a.pick_order - b.pick_order);

  if (draft.status !== 'in_progress' || sortedParticipants.length === 0) {
    return {
      current_pick_user_id: draft.current_pick_user_id ?? null,
      current_pick_number: draft.current_pick_number ?? 1,
      current_round: draft.current_round ?? 1,
      current_pick_profiles: draft.current_pick_profiles ?? null,
    };
  }

  const totalExpectedPicks = sortedParticipants.length * draft.num_rounds;

  if (totalPicks >= totalExpectedPicks) {
    return {
      current_pick_user_id: null,
      current_pick_number: totalExpectedPicks,
      current_round: draft.num_rounds,
      current_pick_profiles: null,
    };
  }

  const roundIndex = Math.floor(totalPicks / sortedParticipants.length);
  const positionInRound = totalPicks % sortedParticipants.length;
  const participantIndex = roundIndex % 2 === 0
    ? positionInRound
    : sortedParticipants.length - 1 - positionInRound;
  const nextPicker = sortedParticipants[participantIndex] ?? null;

  return {
    current_pick_user_id: nextPicker?.user_id ?? null,
    current_pick_number: totalPicks + 1,
    current_round: roundIndex + 1,
    current_pick_profiles: nextPicker?.profiles
      ? { display_name: nextPicker.profiles.display_name }
      : null,
  };
}
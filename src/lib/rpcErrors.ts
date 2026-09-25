const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Please sign in again.",
  NOT_AUTHORISED: "You don't have permission to do that.",
  NOT_AN_ELIGIBLE_MEMBER: "Only active members of this organisation can take part.",
  POSITION_NOT_FOUND: "This position is no longer available.",
  VOTING_CLOSED: "Voting is not open for this election.",
  INVALID_CANDIDATE: "That candidate is not on the ballot.",
  VOTE_ALREADY_CAST:
    "You have already voted for this position, and changes are not allowed in this election.",
  NOMINATIONS_CLOSED: "Nominations are not open for this election.",
  INVALID_NOMINEE: "That person can't be nominated.",
  ALREADY_NOMINATED: "You have already nominated this person for this position.",
  CANDIDACY_NOT_FOUND: "We couldn't find that candidacy.",
  ACCEPTANCE_CLOSED: "The window for accepting candidacies has closed.",
  ALREADY_RESPONDED: "You have already responded to this candidacy.",
  STATUS_CHANGED: "This election was updated by someone else. The page has been refreshed.",
  NO_FURTHER_STEP: "This election has no further steps.",
  NO_POSITIONS: "Add at least one position before opening nominations.",
  POSITION_WITHOUT_CANDIDATES:
    "Every position needs at least one accepted candidate before voting can open.",
  EMAIL_NOT_CONFIRMED: "Please confirm your email address first.",
  NO_PENDING_ORGANISATION: "There is no organisation linked to this account.",
  MEMBERSHIP_LOCKED_DURING_VOTING: "Membership can't be changed while voting is open.",
  NO_ENTRIES: "Add at least one email address.",
  TOO_MANY_ENTRIES: "You can invite up to 500 people at a time.",
  INVITATION_NOT_FOUND: "This invitation link isn't valid. Ask your administrator for a new one.",
  INVITATION_NOT_PENDING: "This invitation has already been used or cancelled.",
  INVITATION_EXPIRED: "This invitation has expired. Ask your administrator to resend it.",
  INVITATION_EMAIL_MISMATCH:
    "This invitation was sent to a different email address. Sign in with that address to accept it.",
  ALREADY_A_MEMBER: "You're already a member of this organisation.",
  INVALID_STATUS: "That status change isn't allowed.",
  MEMBER_NOT_JOINED: "This person hasn't accepted their invitation yet.",
  NAME_REQUIRED: "Please enter a name.",
  RESULTS_NOT_IN_REVIEW: "Ties can only be resolved while results are under review.",
  REASON_REQUIRED: "Please record the reason for this decision.",
  NO_TIE: "There is no tie to resolve for this position.",
  INVALID_TIE_SELECTION:
    "Choose exactly the number of tied candidates needed to fill the remaining seats.",
  UNRESOLVED_TIE: "Resolve all ties before publishing results.",
};

export const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Extracts the known error code (if any) from a database function error. */
export function rpcErrorCode(error: unknown): string | null {
  const msg =
    typeof error === "string"
      ? error
      : (error as { message?: string } | null)?.message ?? "";
  const trimmed = msg.trim();
  if (MESSAGES[trimmed]) return trimmed;
  return Object.keys(MESSAGES).find((code) => new RegExp(`\\b${code}\\b`).test(msg)) ?? null;
}

/** Friendly UK English message for a database function error. Never returns raw errors. */
export function rpcErrorMessage(error: unknown): string {
  const code = rpcErrorCode(error);
  return code ? MESSAGES[code] : GENERIC_ERROR;
}

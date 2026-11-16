/**
 * Rules shared by the game loop and the UI.
 *
 * Lives are intentionally a per-stage resource: every level starts with three
 * and no pickup, perk, or level-clear reward can raise the cap.
 */
export const MAX_PLAYER_LIVES = 3;

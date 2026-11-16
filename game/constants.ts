/**
 * Rules shared by the game loop and the UI.
 *
 * Lives are intentionally a per-stage resource: every level starts with three
 * and no pickup, perk, or level-clear reward can raise the cap.
 */
export const MAX_PLAYER_LIVES = 3;

/** The story map ends at the final chapter boss. Extra generation templates
 * remain available for future expansion, but the shipped campaign is 40 levels. */
export const CAMPAIGN_LEVEL_COUNT = 40;

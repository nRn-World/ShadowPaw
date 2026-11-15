/** Permanent, one-time missions from rescued friends. */
export const CAT_QUESTS = [
  { id: 'miso_fragments', catLevel: 2, target: 3, reward: 100, name: 'Miso', description: 'Hitta 3 skuggfragment åt Miso.' },
  { id: 'luna_fragments', catLevel: 7, target: 5, reward: 150, name: 'Luna', description: 'Hitta 5 skuggfragment åt Luna.' },
] as const;
export function cleanCatQuestClaims(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && CAT_QUESTS.some(q => q.id === id)))];
}
export function claimCatQuest<T extends { rescuedCats: number[]; shadowSecrets: number[]; claimedCatQuests: string[]; coins: number; totalCoinsEarned: number }>(progress: T, id: string): T {
  const quest = CAT_QUESTS.find(q => q.id === id);
  if (!quest || !progress.rescuedCats.includes(quest.catLevel) || progress.shadowSecrets.length < quest.target || progress.claimedCatQuests.includes(id)) return progress;
  return { ...progress, claimedCatQuests: [...progress.claimedCatQuests, id], coins: progress.coins + quest.reward, totalCoinsEarned: progress.totalCoinsEarned + quest.reward };
}

export type RiotIdentity = {
  gameName: string;
  tagLine: string;
};

function stableRiotIdKey(identity: RiotIdentity) {
  return `${identity.gameName.normalize("NFKC").toLocaleLowerCase("en-US")}#${identity.tagLine.normalize("NFKC").toLocaleLowerCase("en-US")}`;
}

export function compareRiotIds(
  left: RiotIdentity,
  right: RiotIdentity,
): number {
  const leftKey = stableRiotIdKey(left);
  const rightKey = stableRiotIdKey(right);
  if (leftKey < rightKey) return -1;
  if (leftKey > rightKey) return 1;
  return 0;
}

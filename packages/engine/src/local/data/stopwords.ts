/** Function words that never count as repetition. */
export const STOPWORDS: ReadonlySet<string> = new Set(
  `a about above after again against all almost also although always am among an and another any
  anyone anything are around as at be because been before being below between both but by can
  could did do does doing done down during each either else enough even ever every few for from
  further get gets getting got had has have having he her here hers herself him himself his how
  however i if in into is it its itself just least less let like made make many may me might mine
  more most much must my myself neither never no nor not now of off often on once one only onto
  or other others our ours ourselves out over own per perhaps quite rather really said same say
  says see seem seems several shall she should since so some something sometimes still such than
  that the their theirs them themselves then there these they thing things this those though
  through thus to too toward towards under until up upon us very via was way we well were what
  when where whether which while who whom whose why will with within without would yet you your
  yours yourself yourselves also able across along already another around back become came come
  comes first going good know known last like long look looks make new next number part people
  really right take time used using want wants way well went year years`
    .split(/\s+/)
    .filter(Boolean),
);

import { runOne, type StrategyId } from '../src/lib/nexus/simulator';
const strategies: StrategyId[] = ['basic','balanced','optimizer','realmix','tourist','spammer','distracted'];
const N = 12;
console.log(`\n=== Endless sim (${N} runs/strategy) ===`);
for (const s of strategies) {
  const runs = [] as any[];
  for (let i = 0; i < N; i++) runs.push(runOne(s, 1000 + i));
  const wins = runs.filter(r => r.victory).length;
  const f = (fn:(r:any)=>number) => (runs.reduce((x,r)=>x+fn(r),0)/N);
  console.log(`${s.padEnd(11)} W=${wins}/${N} waves=${f(r=>r.wavesCleared).toFixed(1)} kills=${Math.round(f(r=>r.kills))} score=${Math.round(f(r=>r.score))} boss=${Math.round(f(r=>r.bossDamage))} leaks=${f(r=>r.leaks).toFixed(1)} hp=${Math.round(f(r=>r.baseHpRemaining))} dur=${Math.round(f(r=>r.durationSec))}s pts=${Math.round(f(r=>r.contributionPoints))}`);
}

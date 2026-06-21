/**
 * NSGA-II multi-objective optimizer over plant topology + sizing.
 *
 * Wraps the headless engine: each candidate genome is decoded to a
 * GraphDefinition, evaluated, and scored on CAPEX / OPEX / footprint, subject to
 * effluent-compliance + convergence constraints. Returns the non-dominated
 * (Pareto-optimal) feasible set. Fully deterministic via a seeded PRNG.
 *
 * Reference: Deb et al. (2002), "A Fast and Elitist Multiobjective Genetic
 * Algorithm: NSGA-II".
 */
import { makeRng } from './prng';
import type { Rng } from './prng';
import { GENOME_LENGTH, decodeVars, decodeToGraph } from './genome';
import type { OptimizerSpec, DecisionVars } from './genome';
import { evaluateObjectives, objectiveVector } from './objectives';
import type { Objectives, ObjectiveOptions } from './objectives';
import type { GraphDefinition } from '../engine/evaluate';

interface Individual {
  genome: number[];
  vars: DecisionVars;
  graph: GraphDefinition;
  objectives: Objectives;
  objVec: number[];
  rank: number;
  crowding: number;
}

export interface OptimizeOptions {
  populationSize?: number;
  generations?: number;
  seed?: number;
  crossoverEta?: number;
  mutationEta?: number;
  mutationProb?: number;
  objective?: ObjectiveOptions;
}

const DEFAULTS = {
  populationSize: 24,
  generations: 20,
  seed: 1234567,
  crossoverEta: 15,
  mutationEta: 20,
};

export interface ParetoPoint {
  vars: DecisionVars;
  graph: GraphDefinition;
  objectives: Objectives;
}

export interface OptimizeResult {
  /** Non-dominated, feasible set, sorted by CAPEX. */
  paretoFront: ParetoPoint[];
  generations: number;
  evaluations: number;
  feasibleCount: number;
}

/** Constraint-domination (Deb): feasibility first, then Pareto on objectives. */
function dominates(a: Individual, b: Individual): boolean {
  const af = a.objectives.feasible, bf = b.objectives.feasible;
  if (af && !bf) return true;
  if (!af && bf) return false;
  if (!af && !bf) return a.objectives.violation < b.objectives.violation;
  let better = false;
  for (let i = 0; i < a.objVec.length; i++) {
    if (a.objVec[i]! > b.objVec[i]!) return false;
    if (a.objVec[i]! < b.objVec[i]!) better = true;
  }
  return better;
}

function fastNonDominatedSort(pop: Individual[]): Individual[][] {
  const fronts: Individual[][] = [[]];
  const dominated: number[][] = pop.map(() => []);
  const dominationCount = pop.map(() => 0);
  for (let p = 0; p < pop.length; p++) {
    for (let q = 0; q < pop.length; q++) {
      if (p === q) continue;
      if (dominates(pop[p]!, pop[q]!)) dominated[p]!.push(q);
      else if (dominates(pop[q]!, pop[p]!)) dominationCount[p]!++;
    }
    if (dominationCount[p] === 0) { pop[p]!.rank = 0; fronts[0]!.push(pop[p]!); }
  }
  let i = 0;
  while (fronts[i]!.length > 0) {
    const next: Individual[] = [];
    for (const p of fronts[i]!) {
      const pIdx = pop.indexOf(p);
      for (const q of dominated[pIdx]!) {
        dominationCount[q]!--;
        if (dominationCount[q] === 0) { pop[q]!.rank = i + 1; next.push(pop[q]!); }
      }
    }
    i++;
    fronts.push(next);
  }
  fronts.pop(); // last is empty
  return fronts;
}

function crowdingDistance(front: Individual[]): void {
  const n = front.length;
  if (n === 0) return;
  for (const ind of front) ind.crowding = 0;
  const m = front[0]!.objVec.length;
  for (let k = 0; k < m; k++) {
    front.sort((a, b) => a.objVec[k]! - b.objVec[k]!);
    front[0]!.crowding = Infinity;
    front[n - 1]!.crowding = Infinity;
    const min = front[0]!.objVec[k]!;
    const max = front[n - 1]!.objVec[k]!;
    const span = max - min || 1;
    for (let j = 1; j < n - 1; j++) {
      front[j]!.crowding += (front[j + 1]!.objVec[k]! - front[j - 1]!.objVec[k]!) / span;
    }
  }
}

/** Crowded-comparison tournament selection. */
function tournament(rng: Rng, pop: Individual[]): Individual {
  const a = pop[rng.int(pop.length)]!;
  const b = pop[rng.int(pop.length)]!;
  if (a.rank !== b.rank) return a.rank < b.rank ? a : b;
  return a.crowding > b.crowding ? a : b;
}

/** Simulated binary crossover (SBX), genes bounded to [0, 1]. */
function sbx(rng: Rng, p1: number[], p2: number[], eta: number): [number[], number[]] {
  const c1 = [...p1], c2 = [...p2];
  for (let i = 0; i < p1.length; i++) {
    if (rng.next() <= 0.5 && Math.abs(p1[i]! - p2[i]!) > 1e-12) {
      const x1 = Math.min(p1[i]!, p2[i]!), x2 = Math.max(p1[i]!, p2[i]!);
      const rand = rng.next();
      const span = x2 - x1;
      const beta1 = 1 + (2 * (x1 - 0)) / span;
      const alpha1 = 2 - Math.pow(beta1, -(eta + 1));
      const bq1 = rand <= 1 / alpha1 ? Math.pow(rand * alpha1, 1 / (eta + 1)) : Math.pow(1 / (2 - rand * alpha1), 1 / (eta + 1));
      const beta2 = 1 + (2 * (1 - x2)) / span;
      const alpha2 = 2 - Math.pow(beta2, -(eta + 1));
      const bq2 = rand <= 1 / alpha2 ? Math.pow(rand * alpha2, 1 / (eta + 1)) : Math.pow(1 / (2 - rand * alpha2), 1 / (eta + 1));
      const ch1 = clamp01(0.5 * (x1 + x2 - bq1 * span));
      const ch2 = clamp01(0.5 * (x1 + x2 + bq2 * span));
      if (rng.next() <= 0.5) { c1[i] = ch2; c2[i] = ch1; } else { c1[i] = ch1; c2[i] = ch2; }
    }
  }
  return [c1, c2];
}

/** Polynomial mutation, genes bounded to [0, 1]. */
function mutate(rng: Rng, genome: number[], eta: number, pMut: number): number[] {
  const g = [...genome];
  for (let i = 0; i < g.length; i++) {
    if (rng.next() <= pMut) {
      const x = g[i]!;
      const rand = rng.next();
      const mutPow = 1 / (eta + 1);
      let deltaq: number;
      if (rand < 0.5) {
        const val = 2 * rand + (1 - 2 * rand) * Math.pow(1 - x, eta + 1);
        deltaq = Math.pow(val, mutPow) - 1;
      } else {
        const val = 2 * (1 - rand) + 2 * (rand - 0.5) * Math.pow(x, eta + 1);
        deltaq = 1 - Math.pow(val, mutPow);
      }
      g[i] = clamp01(x + deltaq);
    }
  }
  return g;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

function dedupeByObjective(front: Individual[]): Individual[] {
  const seen = new Set<string>();
  const out: Individual[] = [];
  for (const ind of front) {
    const key = ind.objVec.map(v => Math.round(v)).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ind);
  }
  return out;
}

/**
 * Run NSGA-II and return the Pareto-optimal feasible set of plant designs.
 */
export function optimizePlant(spec: OptimizerSpec, options: OptimizeOptions = {}): OptimizeResult {
  const N = options.populationSize ?? DEFAULTS.populationSize;
  const G = options.generations ?? DEFAULTS.generations;
  const etaC = options.crossoverEta ?? DEFAULTS.crossoverEta;
  const etaM = options.mutationEta ?? DEFAULTS.mutationEta;
  const pMut = options.mutationProb ?? 1 / GENOME_LENGTH;
  const rng = makeRng(options.seed ?? DEFAULTS.seed);
  let evaluations = 0;

  const evalGenome = (genome: number[]): Individual => {
    const vars = decodeVars(genome);
    const graph = decodeToGraph(vars, spec);
    const objectives = evaluateObjectives(graph, spec, options.objective);
    evaluations++;
    return { genome, vars, graph, objectives, objVec: objectiveVector(objectives), rank: 0, crowding: 0 };
  };

  const randomGenome = (): number[] => Array.from({ length: GENOME_LENGTH }, () => rng.next());

  let pop: Individual[] = Array.from({ length: N }, () => evalGenome(randomGenome()));
  // Rank the initial population so tournament selection has rank/crowding.
  {
    const fronts = fastNonDominatedSort(pop);
    for (const f of fronts) crowdingDistance(f);
  }

  for (let gen = 0; gen < G; gen++) {
    const offspring: Individual[] = [];
    while (offspring.length < N) {
      const p1 = tournament(rng, pop);
      const p2 = tournament(rng, pop);
      const [c1, c2] = sbx(rng, p1.genome, p2.genome, etaC);
      offspring.push(evalGenome(mutate(rng, c1, etaM, pMut)));
      if (offspring.length < N) offspring.push(evalGenome(mutate(rng, c2, etaM, pMut)));
    }
    // (mu + lambda) elitist selection.
    const combined = [...pop, ...offspring];
    const fronts = fastNonDominatedSort(combined);
    const next: Individual[] = [];
    for (const front of fronts) {
      crowdingDistance(front);
      if (next.length + front.length <= N) {
        next.push(...front);
      } else {
        front.sort((a, b) => b.crowding - a.crowding);
        next.push(...front.slice(0, N - next.length));
        break;
      }
    }
    pop = next;
  }

  const fronts = fastNonDominatedSort(pop);
  const front0 = fronts[0] ?? [];
  const feasible = front0.filter(i => i.objectives.feasible);
  const source = feasible.length > 0 ? feasible : front0;
  const paretoFront = dedupeByObjective(source)
    .sort((a, b) => a.objVec[0]! - b.objVec[0]!)
    .map(i => ({ vars: i.vars, graph: i.graph, objectives: i.objectives }));

  return {
    paretoFront,
    generations: G,
    evaluations,
    feasibleCount: pop.filter(i => i.objectives.feasible).length,
  };
}

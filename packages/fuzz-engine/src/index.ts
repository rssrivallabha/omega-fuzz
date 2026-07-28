import { GrammarCorpora, CorpusItem } from './corpora';
import { CoreMutators } from './mutators';

export interface FuzzSeed {
  id: string;
  input: {
    value: any;
  };
  discoveryStrategy: string;
  source?: string;
}

export class MutationEngine {
  private initialCorpus: CorpusItem[] = [];
  private generatedPool: FuzzSeed[] = [];
  private seedIndex = 0;

  constructor(
    readonly targetName: string,
    readonly language: string,
    readonly sourceCode: string,
    baseSynthesizedSeeds: any[] = []
  ) {
    this.initialCorpus = GrammarCorpora.getCorpusForLanguageAndTarget(language, targetName, sourceCode);
    
    // Add synthesized base seeds from adapter into the pool
    baseSynthesizedSeeds.forEach((s, i) => {
      this.generatedPool.push({
        id: s.id || `base_${i+1}`,
        input: s.input || { value: s },
        discoveryStrategy: s.discoveryStrategy || 'Adapter Constraint Synthesis',
        source: 'ADAPTER_SYNTHESIS'
      });
    });

    // Incorporate all grammar corpora items into the pool
    this.initialCorpus.forEach((item, i) => {
      // If the target function expects a dictionary keyword argument struct (like in Python `def foo(**kwargs)`),
      // we wrap simple value literals in the primary parameter name if needed, or provide as both raw and object.
      this.generatedPool.push({
        id: `grammar_${item.category}_${i+1}`,
        input: { value: item.value },
        discoveryStrategy: item.strategy,
        source: 'GRAMMAR_CORPUS'
      });
    });
  }

  getInitialPool(): FuzzSeed[] {
    return this.generatedPool;
  }

  generateLiveInput(iteration: number, targetArgs: string[] = []): FuzzSeed {
    // First, play through all initial seeds and domain grammar corpora to guarantee baseline domain exploration
    if (iteration < this.generatedPool.length) {
      const candidate = this.generatedPool[iteration];
      return this.formatForTargetArgs(candidate, targetArgs, iteration);
    }

    // After baseline grammar exploration, produce genuine LIVE MUTATIONS on every single iteration!
    const baseIndex = Math.floor(Math.random() * this.generatedPool.length);
    const parentSeed = this.generatedPool[baseIndex] || { id: 'default', input: { value: "fuzz_payload" }, discoveryStrategy: 'Fallback' };

    let valueToMutate = parentSeed.input.value;
    // If target expects dict keywords, extract a field value to mutate if appropriate
    if (targetArgs.length > 0 && typeof valueToMutate === 'object' && valueToMutate !== null && !valueToMutate.__omega_bytes_hex) {
      const copy = JSON.parse(JSON.stringify(valueToMutate));
      const targetParam = targetArgs[Math.floor(Math.random() * targetArgs.length)] || Object.keys(copy)[0] || targetArgs[0];
      const res = CoreMutators.mutateValue(copy[targetParam]);
      copy[targetParam] = res.mutated;
      const newSeed: FuzzSeed = {
        id: `mut_${iteration+1}_${Math.random().toString(36).substring(7)}`,
        input: { value: copy },
        discoveryStrategy: `Live Mutation (${res.strategy}) on parameter '${targetParam}'`
      };
      this.generatedPool.push(newSeed); // evolve corpus with interesting mutants
      return newSeed;
    }

    const res = CoreMutators.mutateValue(valueToMutate);
    const mutatedSeed: FuzzSeed = {
      id: `mut_${iteration+1}_${Math.random().toString(36).substring(7)}`,
      input: { value: res.mutated },
      discoveryStrategy: `Live Mutation: ${res.strategy}`
    };
    
    // Evolve corpus with the new mutation
    if (this.generatedPool.length < 1000) {
      this.generatedPool.push(mutatedSeed);
    }

    return this.formatForTargetArgs(mutatedSeed, targetArgs, iteration);
  }

  private formatForTargetArgs(seed: FuzzSeed, targetArgs: string[], iteration: number): FuzzSeed {
    // For Python keyword argument harnesses (`func(**kwargs)`), if the input value is not an object or is a byte envelope,
    // wrap it into a dictionary under the primary parameter name (e.g. `{ data: { __omega_bytes_hex: "..." } }`).
    if (targetArgs && targetArgs.length > 0) {
      const val = seed.input.value;
      if (val === null || typeof val !== 'object' || Array.isArray(val) || val.__omega_bytes_hex !== undefined || val.__omega_bytes_base64 !== undefined) {
        const wrapped: any = {};
        const primaryArg = targetArgs[0];
        wrapped[primaryArg] = val;
        // Populate additional required arguments with sensible defaults so validation doesn't immediately abort before testing the primary parameter
        for (let i = 1; i < targetArgs.length; i++) {
          wrapped[targetArgs[i]] = "default_fuzz_arg";
        }
        return {
          id: seed.id,
          input: { value: wrapped },
          discoveryStrategy: seed.discoveryStrategy,
          source: seed.source
        };
      }
    }
    return seed;
  }
}

export { GrammarCorpora, CoreMutators };

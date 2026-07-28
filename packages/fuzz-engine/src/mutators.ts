import { Buffer } from 'buffer';

export type MutationStrategyName =
  | 'Bit Flip'
  | 'Byte Flip'
  | 'Boundary Arithmetic'
  | 'Dictionary Injection'
  | 'Length & Truncation'
  | 'Recursive Nesting'
  | 'String Splicing & Duplication'
  | 'Binary Byte Corruption';

export class CoreMutators {
  static readonly DICTIONARY_TOKENS = [
    "' OR '1'='1",
    "../../../../etc/passwd",
    "<script>alert(1)</script>",
    "<!DOCTYPE root [<!ENTITY test \"test\">]>",
    "\" OR 1=1 --",
    "\\u0000",
    "\\ufffe\\xffff",
    "<!-- -- -->",
    "${7*7}",
    "{{7*7}}",
    "99999999999999999999999999"
  ];

  static mutateValue(val: any, strategy?: MutationStrategyName): { mutated: any; strategy: string } {
    const strategies: MutationStrategyName[] = [
      'Bit Flip',
      'Byte Flip',
      'Boundary Arithmetic',
      'Dictionary Injection',
      'Length & Truncation',
      'Recursive Nesting',
      'String Splicing & Duplication',
      'Binary Byte Corruption'
    ];
    const chosenStrategy = strategy || strategies[Math.floor(Math.random() * strategies.length)];

    if (val === null || val === undefined) {
      if (chosenStrategy === 'Boundary Arithmetic') return { mutated: 0, strategy: 'Boundary: Null to Zero' };
      if (chosenStrategy === 'Dictionary Injection') return { mutated: { __omega_bytes_hex: '00ff00ff' }, strategy: 'Binary: Null to Bytes Envelope' };
      return { mutated: "", strategy: 'Boundary: Null to Empty String' };
    }

    // Check for raw byte hex envelopes
    if (typeof val === 'object' && val !== null && typeof val.__omega_bytes_hex === 'string') {
      const hex = val.__omega_bytes_hex;
      let newHex = hex;
      if (chosenStrategy === 'Bit Flip' && hex.length > 0) {
        const idx = Math.floor(Math.random() * hex.length);
        const charCode = parseInt(hex[idx], 16) || 0;
        const flipped = (charCode ^ (1 << Math.floor(Math.random() * 4))).toString(16);
        newHex = hex.slice(0, idx) + flipped + hex.slice(idx + 1);
      } else if (chosenStrategy === 'Byte Flip' && hex.length >= 2) {
        const byteIdx = Math.floor(Math.random() * (hex.length / 2)) * 2;
        const replaceBytes = ['00', 'ff', 'fe', '7f', '80', 'c0'];
        const chosenByte = replaceBytes[Math.floor(Math.random() * replaceBytes.length)];
        newHex = hex.slice(0, byteIdx) + chosenByte + hex.slice(byteIdx + 2);
      } else if (chosenStrategy === 'Length & Truncation') {
        if (Math.random() > 0.5 && hex.length > 2) {
          newHex = hex.slice(0, Math.floor(hex.length / 2)); // truncate
        } else {
          newHex = hex.repeat(5).slice(0, 4000); // flood bytes
        }
      } else {
        newHex = hex + 'ffff0000ff';
      }
      return { mutated: { __omega_bytes_hex: newHex }, strategy: `Binary Byte Mutation (${chosenStrategy})` };
    }

    // Numbers
    if (typeof val === 'number') {
      if (chosenStrategy === 'Boundary Arithmetic') {
        const boundaries = [0, -1, 1, 2147483647, -2147483648, 9007199254740991, -9007199254740991, NaN, Infinity, -Infinity];
        return { mutated: boundaries[Math.floor(Math.random() * boundaries.length)], strategy: 'Boundary: Extremal Arithmetic Value' };
      }
      if (chosenStrategy === 'Bit Flip') {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return { mutated: val + delta, strategy: 'Boundary: Arithmetic ±1 Modification' };
      }
      if (chosenStrategy === 'Dictionary Injection') {
        return { mutated: 999999999, strategy: 'Boundary: Integer Overflow Value' };
      }
      return { mutated: val * -1, strategy: 'Boundary: Sign Inversion' };
    }

    // Strings
    if (typeof val === 'string') {
      let str = val;
      if (str.length === 0) str = "test_input";

      if (chosenStrategy === 'Bit Flip' && str.length > 0) {
        const idx = Math.floor(Math.random() * str.length);
        const code = str.charCodeAt(idx);
        const flipped = String.fromCharCode(code ^ (1 << Math.floor(Math.random() * 8)));
        return { mutated: str.slice(0, idx) + flipped + str.slice(idx + 1), strategy: 'Mutation: Single Character Bit Flip' };
      }

      if (chosenStrategy === 'Dictionary Injection') {
        const token = this.DICTIONARY_TOKENS[Math.floor(Math.random() * this.DICTIONARY_TOKENS.length)];
        const insertIdx = Math.floor(Math.random() * (str.length + 1));
        return { mutated: str.slice(0, insertIdx) + token + str.slice(insertIdx), strategy: 'Mutation: Dictionary Token Injection' };
      }

      if (chosenStrategy === 'Length & Truncation') {
        if (Math.random() > 0.5 && str.length > 1) {
          return { mutated: str.slice(0, Math.max(1, Math.floor(str.length / 2))), strategy: 'Mutation: String Truncation' };
        } else {
          return { mutated: str.repeat(20).slice(0, 5000), strategy: 'Mutation: String Flooding & Lengthening' };
        }
      }

      if (chosenStrategy === 'String Splicing & Duplication') {
        if (str.length > 2) {
          const sliceLen = Math.max(1, Math.floor(str.length / 3));
          const chunk = str.slice(0, sliceLen);
          return { mutated: str + chunk.repeat(5), strategy: 'Mutation: Segment Duplication Splicing' };
        }
      }

      if (chosenStrategy === 'Binary Byte Corruption') {
        return { mutated: { __omega_bytes_hex: Buffer.from(str, 'utf-8').toString('hex') + 'fffefe00' }, strategy: 'Mutation: String to Corrupt Binary Byte Envelope' };
      }

      return { mutated: str + "_\x00_overflow", strategy: 'Mutation: Null Byte Append' };
    }

    // Arrays
    if (Array.isArray(val)) {
      if (val.length === 0) {
        return { mutated: ["fuzz_item_1", "fuzz_item_2"], strategy: 'Mutation: Populate Empty Array' };
      }
      if (chosenStrategy === 'Length & Truncation') {
        if (Math.random() > 0.5) {
          return { mutated: [], strategy: 'Boundary: Truncate Array to Empty' };
        } else {
          const duplicated = [];
          for (let i = 0; i < 50; i++) {
            duplicated.push(...val);
          }
          return { mutated: duplicated, strategy: 'Mutation: Array Multiplicative Expansion' };
        }
      }
      // Mutate random element in array
      const copy = [...val];
      const idx = Math.floor(Math.random() * copy.length);
      const res = this.mutateValue(copy[idx]);
      copy[idx] = res.mutated;
      return { mutated: copy, strategy: `Array Element Mutation: ${res.strategy}` };
    }

    // Objects / Dictionaries
    if (typeof val === 'object') {
      const copy = JSON.parse(JSON.stringify(val));
      const keys = Object.keys(copy);

      if (chosenStrategy === 'Recursive Nesting') {
        return { mutated: { nested: { nested: { nested: { nested: copy } } } }, strategy: 'Mutation: Recursive Object Nesting' };
      }
      if (chosenStrategy === 'Dictionary Injection' || keys.length === 0) {
        copy["injected_key_" + Math.random().toString(36).substring(7)] = "injected_payload";
        return { mutated: copy, strategy: 'Mutation: Dictionary Key Injection' };
      }
      if (chosenStrategy === 'Length & Truncation') {
        const removeKey = keys[Math.floor(Math.random() * keys.length)];
        delete copy[removeKey];
        return { mutated: copy, strategy: `Boundary: Remove Dictionary Key '${removeKey}'` };
      }

      // Mutate a random value inside dictionary
      const targetKey = keys[Math.floor(Math.random() * keys.length)];
      const res = this.mutateValue(copy[targetKey]);
      copy[targetKey] = res.mutated;
      return { mutated: copy, strategy: `Dictionary Field ('${targetKey}') Mutation: ${res.strategy}` };
    }

    return { mutated: "default_fallback_fuzz", strategy: 'Mutation: Default Fallback' };
  }
}

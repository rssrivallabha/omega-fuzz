import { SerializedInput, CanonicalValue } from '@omega-fuzz/canonical-model';

export class LosslessSerializer {
  static serialize(value: CanonicalValue): SerializedInput {
    if (value === undefined) {
      return { $type: 'undefined' };
    }
    if (value === null) {
      return null;
    }
    if (typeof value === 'number') {
      if (Number.isNaN(value)) return { $type: 'float', value: 'NaN' };
      if (value === Number.POSITIVE_INFINITY) return { $type: 'float', value: 'Infinity' };
      if (value === Number.NEGATIVE_INFINITY) return { $type: 'float', value: '-Infinity' };
      return value;
    }
    if (typeof value === 'bigint') {
      return { $type: 'bigint', value: value.toString() };
    }
    if (typeof value === 'boolean' || typeof value === 'string') {
      return value;
    }
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
      return { $type: 'bytes', encoding: 'base64', value: buf.toString('base64') };
    }
    if (Array.isArray(value)) {
      return { $type: 'array', value: value.map(v => this.serialize(v)) };
    }
    if (typeof value === 'object') {
      const result: Record<string, SerializedInput> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.serialize(v);
      }
      return { $type: 'object', value: result };
    }
    
    // Fallback to string representation for unsupported types to prevent crashing
    return String(value);
  }

  static deserialize(serialized: SerializedInput): CanonicalValue {
    if (serialized === null || typeof serialized === 'string' || typeof serialized === 'number' || typeof serialized === 'boolean') {
      return serialized;
    }
    
    if (typeof serialized === 'object' && '$type' in serialized) {
      switch (serialized.$type) {
        case 'undefined': return undefined;
        case 'float':
          if (serialized.value === 'NaN') return Number.NaN;
          if (serialized.value === 'Infinity') return Number.POSITIVE_INFINITY;
          if (serialized.value === '-Infinity') return Number.NEGATIVE_INFINITY;
          break;
        case 'bigint':
          return BigInt(serialized.value);
        case 'bytes':
          if (serialized.encoding === 'base64') {
            return Buffer.from(serialized.value, 'base64');
          }
          break;
        case 'array':
          return serialized.value.map(v => this.deserialize(v));
        case 'object':
          const obj: Record<string, CanonicalValue> = {};
          for (const [k, v] of Object.entries(serialized.value)) {
            obj[k] = this.deserialize(v);
          }
          return obj;
      }
    }
    
    throw new Error('Invalid serialized input format');
  }
}

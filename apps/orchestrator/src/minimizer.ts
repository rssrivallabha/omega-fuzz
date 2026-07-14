export class Minimizer {
  // A naive structural shrinker for valid JSON structures
  async minimize(inputStr: string): Promise<string> {
    try {
      const data = JSON.parse(inputStr);
      if (typeof data !== 'object' || data === null) {
        return inputStr; // Cannot structurally minimize primitives easily without specific type info
      }

      if (Array.isArray(data)) {
         if (data.length > 1) {
             return JSON.stringify([data[0]]); // Shrink array to first element
         }
         return inputStr;
      }

      // It's an object. Try to remove keys one by one (simplistic)
      const keys = Object.keys(data);
      if (keys.length > 1) {
          const minimizedData = { ...data };
          delete minimizedData[keys[keys.length - 1]];
          return JSON.stringify(minimizedData);
      }

      return inputStr;
    } catch (e) {
      // Not JSON, or other error, return as is
      return inputStr;
    }
  }
}

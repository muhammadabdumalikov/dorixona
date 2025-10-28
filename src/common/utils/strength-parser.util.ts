export interface ParsedStrength {
  value: number;
  unit: string;
  original: string;
}

export class StrengthParser {
  private static readonly UNIT_PATTERNS = [
    { pattern: /(\d+(?:\.\d+)?)\s*mg/i, unit: 'mg' },
    { pattern: /(\d+(?:\.\d+)?)\s*g/i, unit: 'g' },
    { pattern: /(\d+(?:\.\d+)?)\s*ml/i, unit: 'ml' },
    { pattern: /(\d+(?:\.\d+)?)\s*IU/i, unit: 'IU' },
    { pattern: /(\d+(?:\.\d+)?)\s*%/, unit: '%' },
    { pattern: /(\d+(?:\.\d+)?)\s*mcg/i, unit: 'mcg' },
    { pattern: /(\d+(?:\.\d+)?)\s*μg/i, unit: 'μg' },
  ];

  /**
   * Parse strength string into value and unit
   * Examples: "500mg" -> {value: 500, unit: "mg"}, "0.05%" -> {value: 0.05, unit: "%"}
   */
  static parse(strength: string): ParsedStrength | null {
    if (!strength || typeof strength !== 'string') {
      return null;
    }

    const trimmed = strength.trim();

    for (const { pattern, unit } of this.UNIT_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        if (!isNaN(value)) {
          return {
            value,
            unit,
            original: trimmed,
          };
        }
      }
    }

    return null;
  }

  /**
   * Compare two strength values with tolerance
   * Returns true if strengths are within tolerance (default 10%)
   */
  static compare(strength1: ParsedStrength, strength2: ParsedStrength, tolerance: number = 0.1): boolean {
    if (!strength1 || !strength2) {
      return false;
    }

    // Must have same unit
    if (strength1.unit !== strength2.unit) {
      return false;
    }

    // Calculate tolerance range
    const diff = Math.abs(strength1.value - strength2.value);
    const avgValue = (strength1.value + strength2.value) / 2;
    const toleranceValue = avgValue * tolerance;

    return diff <= toleranceValue;
  }

  /**
   * Check if two medicines have compatible dosage forms
   */
  static areDosageFormsCompatible(form1: string, form2: string): boolean {
    if (!form1 || !form2) {
      return false;
    }

    const form1Lower = form1.toLowerCase();
    const form2Lower = form2.toLowerCase();

    // Exact match
    if (form1Lower === form2Lower) {
      return true;
    }

    // Compatible forms mapping
    const compatibleForms = {
      'tablet': ['tablet', 'tab', 'таблетка'],
      'capsule': ['capsule', 'cap', 'капсула'],
      'syrup': ['syrup', 'сироп'],
      'injection': ['injection', 'injectable', 'инъекция'],
      'drops': ['drops', 'капли'],
      'cream': ['cream', 'ointment', 'крем', 'мазь'],
      'gel': ['gel', 'гель'],
    };

    for (const [key, forms] of Object.entries(compatibleForms)) {
      if (forms.includes(form1Lower) && forms.includes(form2Lower)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get medical disclaimer text
   */
  static getDisclaimer(): string {
    return 'Consult your doctor or pharmacist before switching medicines. Not all generics are interchangeable, especially for narrow therapeutic index drugs.';
  }
}

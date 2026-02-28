export interface Serving {
  size_g?: number | null;
  size_ml?: number | null;
  per_container_servings?: number | null;
}

export interface Nutrition {
  calories?: number | null;
  carbs_g?: number | null;
  sugars_g?: number | null;
  added_sugars_g?: number | null;
  polyols_g?: number | null;
  fiber_g?: number | null;
  net_carbs_g?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  sat_fat_g?: number | null;
  sodium_mg?: number | null;
  cholesterol_mg?: number | null;
}

export interface Product {
  barcode: string;
  name: string;
  brand?: string | null;
  serving: Serving;
  nutrition: Nutrition;
  ingredients_text?: string | null;
  ingredients_tokens: string[];
  labels_tags: string[];
  allergens_tags: string[];
  traces_tags: string[];
  ingredients_analysis_tags: string[];
}

export interface FilterProfile {
  diet?: string | null;
  religion?: string | null;
  medical?: string | null;
  allergens: string[];
  unitsPreference: 'per_serving' | 'per_100g';
  strictness: 'strict' | 'balanced' | 'lenient';
}

export interface RuleResult {
  id: string;
  type: string;
  severity: string;
  matched: boolean;
  message: string;
  code: string;
}

export interface EvaluationResponse {
  verdict: 'PASS' | 'CAUTION' | 'FAIL';
  score: number;
  reasons: string[];
  reason_codes: string[];
  rule_details: RuleResult[];
  missing_data: string[];
  version: string;
}

export interface RuleDefinition {
  id: string;
  type: 'allergen' | 'diet' | 'ingredient' | 'label' | 'nutrient';
  severity: 'hard' | 'soft';
  applies_when?: Record<string, any>;
  applies_when_key?: string;
  match?: { any_of: string[] };
  match_from_profile?: string;
  metric?: keyof Nutrition;
  basis?: 'per_serving' | 'per_100g';
  op?: '>' | '>=' | '<' | '<=' | '==' | '!=';
  rhs?: number | string;
  weights?: { penalty?: number };
  message_template: string;
}

// --- Constants ---

export const RULES: RuleDefinition[] = [
  {
    "id": "ALLERGEN_MATCH_FROM_PROFILE",
    "type": "allergen",
    "severity": "hard",
    "match_from_profile": "allergens",
    "message_template": "Contains an allergen: {matched}."
  },
  {
    "id": "CELIAC_GLUTEN_ING",
    "type": "diet",
    "severity": "hard",
    "applies_when": {
      "medical": "celiac"
    },
    "match": {
      "any_of": [
        "wheat", "barley", "rye", "malt", "semolina", "spelt", "khorasan", "farro", "triticale"
      ]
    },
    "message_template": "Celiac restriction: gluten ingredient detected ({matched}). This might be problematic for some individuals."
  },
  {
    "id": "REL_PORK_ALCOHOL",
    "type": "ingredient",
    "severity": "hard",
    "applies_when": {
      "religion": "halal"
    },
    "match": {
      "any_of": [
        "pork", "bacon", "ham", "lard", "porcine", "alcohol", "wine", "beer", "rum", "brandy", "liqueur"
      ]
    },
    "message_template": "Not permitted: {matched}. This appears to contain restricted ingredients."
  },
  {
    "id": "REL_PORK_SHELLFISH",
    "type": "ingredient",
    "severity": "hard",
    "applies_when": {
      "religion": "kosher"
    },
    "match": {
      "any_of": [
        "pork", "bacon", "ham", "lard", "porcine", "shellfish", "shrimp", "lobster", "crab"
      ]
    },
    "message_template": "Not permitted: {matched}. This appears to contain restricted ingredients."
  },
  {
    "id": "DIET_VEGAN",
    "type": "diet",
    "severity": "hard",
    "applies_when": {
      "diet": "vegan"
    },
    "match": {
      "any_of": [
        "meat", "beef", "pork", "chicken", "turkey", "fish", "shellfish", "egg", "honey", "milk", "casein", "whey", "gelatin", "rennet", "lactose", "butter", "cheese", "yogurt", "ghee"
      ]
    },
    "message_template": "Not vegan: appears to contain {matched}."
  },
  {
    "id": "DIET_VEGETARIAN",
    "type": "diet",
    "severity": "hard",
    "applies_when": {
      "diet": "vegetarian"
    },
    "match": {
      "any_of": [
        "meat", "beef", "pork", "chicken", "turkey", "fish", "shellfish", "gelatin", "rennet"
      ]
    },
    "message_template": "Not vegetarian: appears to contain {matched}."
  },
  {
    "id": "DIET_DAIRY_FREE",
    "type": "diet",
    "severity": "hard",
    "applies_when": {
      "diet": "dairy-free"
    },
    "match": {
      "any_of": [
        "milk", "casein", "whey", "lactose", "butter", "ghee", "cheese", "yogurt", "cream"
      ]
    },
    "message_template": "Not dairy-free: appears to contain dairy ({matched})."
  },
  {
    "id": "DIET_PORK_FREE",
    "type": "diet",
    "severity": "hard",
    "applies_when": {
      "diet": "pork-free"
    },
    "match": {
      "any_of": [
        "pork", "bacon", "ham", "lard", "porcine"
      ]
    },
    "message_template": "Not pork-free: appears to contain pork-derived ingredient ({matched})."
  },
  {
    "id": "SUGAR_HIGH",
    "type": "nutrient",
    "severity": "soft",
    "metric": "sugars_g",
    "basis": "per_serving",
    "op": ">",
    "rhs": 10,
    "weights": {
      "penalty": 35
    },
    "message_template": "Suggestion: Sugar content ({actual}g) appears to be on the higher side per serving."
  },
  {
    "id": "SODIUM_HIGH",
    "type": "nutrient",
    "severity": "soft",
    "metric": "sodium_mg",
    "basis": "per_serving",
    "op": ">=",
    "rhs": 460,
    "weights": {
      "penalty": 30
    },
    "message_template": "Suggestion: Sodium level ({actual}mg) might be considered high per serving (approx. ≥20% DV)."
  },
  {
    "id": "SAT_FAT_HIGH",
    "type": "nutrient",
    "severity": "soft",
    "metric": "sat_fat_g",
    "basis": "per_serving",
    "op": ">=",
    "rhs": 5,
    "weights": {
      "penalty": 20
    },
    "message_template": "Suggestion: Saturated fat ({actual}g) might be considered high per serving."
  },
  {
    "id": "HIGHLY_PROCESSED_WARNING",
    "type": "ingredient",
    "severity": "soft",
    "match": {
      "any_of": ["processed_foods"]
    },
    "weights": {
      "penalty": 25
    },
    "message_template": "Suggestion: Appears to be highly processed due to the presence of additives, artificial ingredients, or refined syrups ({matched})."
  },
  {
    "id": "LOW_NUTRITIONAL_DENSITY",
    "type": "nutrient",
    "severity": "soft",
    "metric": "calories",
    "basis": "per_serving",
    "op": ">",
    "rhs": 250,
    "weights": {
      "penalty": 15
    },
    "message_template": "Notice: This product is somewhat high in calories per serving ({actual} kcal). Consider its nutritional density relative to your daily needs."
  },
  {
    "id": "KETO_NET_CARBS",
    "type": "nutrient",
    "severity": "soft",
    "applies_when": {
      "diet": "keto"
    },
    "metric": "net_carbs_g",
    "basis": "per_serving",
    "op": ">",
    "rhs": 10,
    "weights": {
      "penalty": 25
    },
    "message_template": "Net carbs {actual}g may exceed keto target (10g/serv)."
  },
  {
    "id": "ARTIFICIAL_SWEETENER_FOUND",
    "type": "ingredient",
    "severity": "soft",
    "match": {
      "any_of": ["artificial_sweeteners"]
    },
    "weights": {
      "penalty": 15
    },
    "message_template": "Notice: Artificial sweetener ({matched}) found. These can sometimes impact gut health or sweet cravings."
  },
  {
    "id": "PRESERVATIVE_FOUND",
    "type": "ingredient",
    "severity": "soft",
    "match": {
      "any_of": ["preservatives"]
    },
    "weights": {
      "penalty": 10
    },
    "message_template": "Notice: Preservative ({matched}) detected. These are used to extend shelf life but are often considered 'unnatural' in a whole-food diet."
  },
  {
    "id": "ARTIFICIAL_COLOR_FOUND",
    "type": "ingredient",
    "severity": "soft",
    "match": {
      "any_of": ["artificial_colors"]
    },
    "weights": {
      "penalty": 15
    },
    "message_template": "Suggestion: Artificial food dye ({matched}) detected. Some studies suggest these might affect behavior or sensitivity in some individuals."
  },
  {
    "id": "ADDITIVE_THICKENER_FOUND",
    "type": "ingredient",
    "severity": "soft",
    "match": {
      "any_of": ["additives_thickeners"]
    },
    "weights": {
      "penalty": 5
    },
    "message_template": "Notice: Processing agent/thickener ({matched}) detected. These are common in processed foods to improve texture."
  },
  {
    "id": "TRANS_FAT_FOUND",
    "type": "ingredient",
    "severity": "hard",
    "match": {
      "any_of": ["trans_fats"]
    },
    "weights": {
      "penalty": 50
    },
    "message_template": "Warning: Partially hydrogenated oils or trans fats ({matched}) detected. These are widely recommended to be avoided for heart health."
  },
  {
    "id": "UNNATURAL_SYRUP_FOUND",
    "type": "ingredient",
    "severity": "soft",
    "match": {
      "any_of": ["unnatural_syrups"]
    },
    "weights": {
      "penalty": 30
    },
    "message_template": "Suggestion: Refined syrup ({matched}) detected. These highly processed sugars may contribute to inflammation and rapid blood sugar spikes."
  },
  {
    "id": "WHOLE_GRAIN_POSITIVE",
    "type": "label",
    "severity": "soft",
    "match": {
      "any_of": ["whole_grains"]
    },
    "weights": {
      "penalty": -10
    },
    "message_template": "Positive: Appears to contain whole grains ({matched}), which are great for fiber and sustained energy."
  },
  {
    "id": "FIBER_POSITIVE",
    "type": "nutrient",
    "severity": "soft",
    "metric": "fiber_g",
    "basis": "per_serving",
    "op": ">=",
    "rhs": 3,
    "weights": {
      "penalty": -5
    },
    "message_template": "Positive: Good source of fiber ({actual}g per serving), which supports healthy digestion."
  },
  {
    "id": "PROTEIN_POSITIVE",
    "type": "nutrient",
    "severity": "soft",
    "metric": "protein_g",
    "basis": "per_serving",
    "op": ">=",
    "rhs": 10,
    "weights": {
      "penalty": -5
    },
    "message_template": "Positive: High protein content ({actual}g per serving), which may help with muscle repair and satiety."
  },
  {
    "id": "SESAME_ALLERGEN",
    "type": "allergen",
    "severity": "hard",
    "match_from_profile": "allergens",
    "match": { "any_of": ["sesame"] },
    "message_template": "Warning: Contains sesame ({matched}), which you've marked as an allergen."
  },
  {
    "id": "SUGAR_ALCOHOL_ALLERGEN",
    "type": "allergen",
    "severity": "hard",
    "match_from_profile": "allergens",
    "match": { "any_of": ["sugar_alcohols"] },
    "message_template": "Notice: Contains sugar alcohols ({matched}), which you've chosen to avoid."
  },
  {
    "id": "SEED_OILS_ALLERGEN",
    "type": "allergen",
    "severity": "hard",
    "match_from_profile": "allergens",
    "match": { "any_of": ["seed_oils"] },
    "message_template": "Notice: Contains seed oils ({matched}), which you've chosen to avoid."
  },
  {
    "id": "HFCS_ALLERGEN",
    "type": "allergen",
    "severity": "hard",
    "match_from_profile": "allergens",
    "match": { "any_of": ["hfcs"] },
    "message_template": "Notice: Contains High-Fructose Corn Syrup ({matched}), which you've chosen to avoid."
  },
  {
    "id": "DIET_PESCETARIAN",
    "type": "diet",
    "severity": "hard",
    "applies_when": { "diet": "pescetarian" },
    "match": { "any_of": ["meat", "beef", "pork", "chicken", "turkey", "lamb", "goat"] },
    "message_template": "Not pescetarian: appears to contain meat ({matched})."
  },
  {
    "id": "DIET_CARNIVORE",
    "type": "diet",
    "severity": "hard",
    "applies_when": { "diet": "carnivore" },
    "match": { "any_of": ["whole_grains", "legumes", "unnatural_syrups", "sugar_alcohols", "seed_oils", "artificial_sweeteners"] },
    "message_template": "Carnivore alert: contains plant-based or processed ingredient ({matched})."
  },
  {
    "id": "DIET_MEDITERRANEAN",
    "type": "diet",
    "severity": "soft",
    "applies_when": { "diet": "mediterranean" },
    "match": { "any_of": ["red_meat", "processed_foods"] },
    "message_template": "Mediterranean suggestion: contains red meat or processed ingredients ({matched}), which are typically minimized in this diet."
  },
  {
    "id": "DIET_PALEO",
    "type": "diet",
    "severity": "hard",
    "applies_when": { "diet": "paleo" },
    "match": { "any_of": ["whole_grains", "legumes", "milk", "unnatural_syrups"] },
    "message_template": "Not paleo: contains non-paleo ingredient ({matched})."
  },
  {
    "id": "DIET_HIGH_PROTEIN",
    "type": "nutrient",
    "severity": "soft",
    "applies_when": { "diet": "high-protein" },
    "metric": "protein_g",
    "basis": "per_serving",
    "op": "<",
    "rhs": 15,
    "weights": { "penalty": 10 },
    "message_template": "High-Protein goal: This product has {actual}g of protein per serving, which might be lower than your target for high-protein foods."
  },
  {
    "id": "MEDICAL_DIABETES",
    "type": "nutrient",
    "severity": "soft",
    "applies_when": { "medical": "diabetes" },
    "metric": "sugars_g",
    "basis": "per_serving",
    "op": ">",
    "rhs": 5,
    "weights": { "penalty": 30 },
    "message_template": "Diabetes management: Sugars ({actual}g) might be high for a single serving. Please check with your healthcare provider."
  },
  {
    "id": "MEDICAL_LOW_SODIUM",
    "type": "nutrient",
    "severity": "soft",
    "applies_when": { "medical": "low sodium" },
    "metric": "sodium_mg",
    "basis": "per_serving",
    "op": ">",
    "rhs": 140,
    "weights": { "penalty": 20 },
    "message_template": "Low sodium restriction: Sodium ({actual}mg) appears to be above the 'low sodium' threshold (140mg) per serving."
  },
  {
    "id": "MEDICAL_CHOLESTEROL",
    "type": "nutrient",
    "severity": "soft",
    "applies_when": { "medical": "cholesterol" },
    "metric": "sat_fat_g",
    "basis": "per_serving",
    "op": ">",
    "rhs": 2,
    "weights": { "penalty": 15 },
    "message_template": "Cholesterol concern: Saturated fat ({actual}g) might be high, which can affect cholesterol levels."
  },
  {
    "id": "MEDICAL_CROHNS",
    "type": "ingredient",
    "severity": "soft",
    "applies_when": { "medical": "crohn's" },
    "match": { "any_of": ["artificial_sweeteners", "preservatives", "additives_thickeners", "seed_oils"] },
    "message_template": "Crohn's suggestion: contains ingredients ({matched}) that some find might affect digestive comfort."
  }
];

export const SYNONYMS: Record<string, string[]> = {
  "milk": ["casein", "sodium caseinate", "calcium caseinate", "whey", "lactose", "butter", "ghee", "cheese", "yogurt", "cream", "milk solids", "milk powder"],
  "pork": ["porcine", "bacon", "ham", "lard", "pepperoni"],
  "sesame": ["sesame", "tahini", "sesamum", "benne", "gingelly"],
  "sugar_alcohols": ["erythritol", "xylitol", "sorbitol", "maltitol", "mannitol", "isomalt", "lactitol", "hydrogenated starch hydrolysates"],
  "seed_oils": ["canola oil", "rapeseed oil", "sunflower oil", "safflower oil", "corn oil", "soybean oil", "cottonseed oil", "grapeseed oil", "rice bran oil"],
  "hfcs": ["high fructose corn syrup", "hfcs", "glucose-fructose syrup"],
  "gluten": ["wheat", "barley", "rye", "malt", "semolina", "spelt", "khorasan", "farro", "triticale"],
  "shellfish": ["shrimp", "prawn", "lobster", "crab", "crustacean", "langostino", "scampi"],
  "egg": ["egg", "albumen", "ovalbumin", "egg white", "egg yolk", "ovomucoid"],
  "meat": ["beef", "pork", "chicken", "turkey", "lamb", "goat"],
  "peanuts": ["peanut", "peanuts", "groundnut", "arachis"],
  "tree nuts": ["almond", "walnut", "pecan", "cashew", "pistachio", "hazelnut", "brazil nut", "macadamia", "pine nut"],
  "soy": ["soy", "soya", "soybean", "soy lecithin", "edamame", "tempeh", "textured", "tvp"],
  "artificial_sweeteners": [
    "aspartame", "sucralose", "saccharin", "acesulfame potassium", "acesulfame k", "neotame", "advantame", "monk fruit extract", "stevia extract", "erythritol", "xylitol", "sorbitol", "maltitol", "mannitol", "isomalt"
  ],
  "preservatives": [
    "sodium benzoate", "potassium sorbate", "calcium propionate", "sodium nitrate", "sodium nitrite", "bha", "bht", "tbhq", "sulfur dioxide", "sodium bisulfite", "potassium metabisulfite"
  ],
  "artificial_colors": [
    "red 40", "yellow 5", "yellow 6", "blue 1", "blue 2", "red 3", "green 3", "orange b", "citrus red 2", "allura red", "tartrazine", "sunset yellow", "brilliant blue", "indigotine", "erythrosine", "fast green"
  ],
  "additives_thickeners": [
    "carrageenan", "xanthan gum", "guar gum", "locust bean gum", "maltodextrin", "modified corn starch", "modified food starch", "cellulose gum", "pectin", "soy lecithin", "sunflower lecithin"
  ],
  "trans_fats": [
    "partially hydrogenated oil", "hydrogenated vegetable oil", "hydrogenated palm oil", "hydrogenated soybean oil", "shortening"
  ],
  "unnatural_syrups": [
    "high fructose corn syrup", "hfcs", "corn syrup", "glucose-fructose syrup", "agave nectar", "brown rice syrup", "barley malt syrup"
  ],
  "whole_grains": [
    "whole wheat", "whole grain", "oats", "oatmeal", "brown rice", "quinoa", "barley", "buckwheat", "millet", "spelt", "amaranth"
  ],
  "natural_sweeteners": [
    "honey", "maple syrup", "dates", "date paste", "monk fruit", "stevia leaf"
  ],
  "red_meat": ["beef", "pork", "lamb", "goat", "mutton", "veal", "venison"],
  "animal_products": ["meat", "beef", "pork", "chicken", "turkey", "fish", "shellfish", "egg", "honey", "milk", "casein", "whey", "gelatin", "rennet", "lactose", "butter", "cheese", "yogurt", "ghee", "lard", "tallow", "suet"],
  "nightshades": ["tomato", "potato", "eggplant", "pepper", "chili", "paprika", "ashwagandha", "goji berry"],
  "legumes": ["soy", "peanut", "bean", "lentil", "chickpea", "pea", "lupin"],
  "paleo_restricted": ["grain", "legume", "dairy", "sugar", "processed oil"],
  "processed_foods": ["artificial_sweeteners", "preservatives", "artificial_colors", "additives_thickeners", "trans_fats", "unnatural_syrups", "modified corn starch", "maltodextrin", "dextrose", "natural flavors", "artificial flavors", "flavor enhancer", "monosodium glutamate", "msg", "disodium inosinate", "disodium guanylate", "autolyzed yeast extract", "canola oil", "rapeseed oil", "sunflower oil", "safflower oil", "corn oil", "soybean oil", "cottonseed oil", "enriched flour", "bleached flour", "degerminated", "modified starch"]
};

// --- Normalization ---

function parseServingSize(servingSizeTxt?: string | null): { size_g?: number | null; size_ml?: number | null } {
  if (!servingSizeTxt) return { size_g: null, size_ml: null };
  const s = servingSizeTxt.toLowerCase();
  let size_g = null;
  let size_ml = null;
  
  const gMatch = s.match(/([0-9]*\.?[0-9]+)\s*g\b/);
  if (gMatch) size_g = parseFloat(gMatch[1]);
  
  const mlMatch = s.match(/([0-9]*\.?[0-9]+)\s*ml\b/);
  if (mlMatch) size_ml = parseFloat(mlMatch[1]);
  
  return { size_g, size_ml };
}

function scale100gToServing(val100g?: number | null, servingSizeG?: number | null): number | null {
  if (val100g === undefined || val100g === null || servingSizeG === undefined || servingSizeG === null) {
    return null;
  }
  return val100g * (servingSizeG / 100.0);
}

export function normalizeOFF(offJson: any): Product {
  const p = offJson.product || {};
  const n = p.nutriments || {};

  const { size_g, size_ml } = parseServingSize(p.serving_size);

  const perServ = (key: string, to?: (v: number) => number): number | null => {
    let direct = n[`${key}_serving`];
    if (direct !== undefined && direct !== null) {
      try {
        const v = parseFloat(direct);
        if (!isNaN(v)) return to ? to(v) : v;
      } catch (e) {}
    }
    let v100 = n[`${key}_100g`];
    if (v100 !== undefined && v100 !== null) {
      try {
        const val100 = parseFloat(v100);
        if (!isNaN(val100)) {
          const v = scale100gToServing(val100, size_g);
          return (to && v !== null) ? to(v) : v;
        }
      } catch (e) {}
    }
    return null;
  };

  const sodium_mg = perServ('sodium', (g) => Math.round(g * 1000 * 10) / 10);
  let carbs = perServ('carbohydrates');
  const fiber = perServ('fiber');
  const polyols = perServ('polyols');
  const sugars = perServ('sugars');
  const added_sugars = perServ('added-sugars');
  const protein = perServ('proteins');
  const fat = perServ('fat');
  const sat_fat = perServ('saturated-fat');
  const kcal = perServ('energy-kcal');

  if (carbs === null && sugars !== null) carbs = sugars;

  let net_carbs = null;
  if (carbs !== null) {
    net_carbs = carbs - (fiber || 0) - (polyols || 0);
    if (net_carbs < 0) net_carbs = 0;
  }

  return {
    barcode: p.code || offJson.code || '',
    name: p.product_name || p.product_name_en || '',
    brand: p.brands ? p.brands.split(',')[0].trim() : null,
    serving: { size_g, size_ml },
    nutrition: {
      calories: kcal, carbs_g: carbs, sugars_g: sugars, added_sugars_g: added_sugars,
      polyols_g: polyols, fiber_g: fiber, net_carbs_g: net_carbs,
      protein_g: protein, fat_g: fat, sat_fat_g: sat_fat, sodium_mg: sodium_mg
    },
    ingredients_text: p.ingredients_text,
    ingredients_tokens: (p.ingredients || []).map((i: any) => (i.text || '').toLowerCase()).filter(Boolean),
    labels_tags: (p.labels_tags || []).map((t: string) => t.toLowerCase()),
    allergens_tags: (p.allergens_tags || []).map((t: string) => t.toLowerCase()),
    traces_tags: (p.traces_tags || []).map((t: string) => t.toLowerCase()),
    ingredients_analysis_tags: (p.ingredients_analysis_tags || []).map((t: string) => t.toLowerCase())
  };
}

// --- Rules Engine ---

export class RulesEngine {
  rules: RuleDefinition[];
  synonyms: Record<string, string[]>;

  constructor(rules: RuleDefinition[], synonyms: Record<string, string[]> = {}) {
    this.rules = rules;
    this.synonyms = synonyms;
  }

  private getProfileValue(profile: FilterProfile, path: string): any {
    const parts = path.split('.');
    let node: any = profile;
    for (const seg of parts) {
      if (node && typeof node === 'object' && seg in node) {
        node = node[seg];
      } else {
        return null;
      }
    }
    return node;
  }

  private getTokens(text: string | null | undefined, tokens: string[]): Set<string> {
    let base = tokens.map(t => t.trim().toLowerCase());
    if (text) {
      const splitText = text.toLowerCase().split(/[\s,;()\-_.:/+]+/).filter(Boolean);
      base = base.concat(splitText);
    }
    const expanded = new Set(base);
    for (const t of Array.from(expanded)) {
      const syns = this.synonyms[t] || [];
      for (const s of syns) expanded.add(s.toLowerCase());
    }
    return expanded;
  }

  private compare(lhs: number | null | undefined, op: string, rhs: number | null | undefined): boolean {
    if (lhs === null || lhs === undefined || rhs === null || rhs === undefined) return false;
    switch (op) {
      case '>': return lhs > rhs;
      case '>=': return lhs >= rhs;
      case '<': return lhs < rhs;
      case '<=': return lhs <= rhs;
      case '==': return lhs === rhs;
      case '!=': return lhs !== rhs;
      default: return false;
    }
  }

  evaluate(product: Product, profile: FilterProfile): EvaluationResponse {
    const ingTokens = this.getTokens(product.ingredients_text, product.ingredients_tokens);
    let score = 100.0;
    let hardViolation = false;
    const reasons: string[] = [];
    const reasonCodes: string[] = [];
    const details: RuleResult[] = [];
    const missingData: string[] = [];

    for (const r of this.rules) {
      let matched = false;
      let msg = "";

      // Applicability
      if (r.applies_when) {
        let allMet = true;
        for (const [k, v] of Object.entries(r.applies_when)) {
          if ((profile as any)[k] !== v) {
            allMet = false;
            break;
          }
        }
        if (!allMet) {
          details.push({ id: r.id, type: r.type, severity: r.severity, matched: false, message: "", code: r.id });
          continue;
        }
      }
      if (r.applies_when_key && this.getProfileValue(profile, r.applies_when_key) === null) {
        details.push({ id: r.id, type: r.type, severity: r.severity, matched: false, message: "", code: r.id });
        continue;
      }

      // Non-nutrient matching
      if (['allergen', 'ingredient', 'diet', 'label'].includes(r.type)) {
        const candidates = new Set<string>();
        if (r.match?.any_of) {
          for (const s of r.match.any_of) {
            const lowerS = s.toLowerCase();
            if (this.synonyms[lowerS]) {
              candidates.add(lowerS);
              for (const syn of this.synonyms[lowerS]) candidates.add(syn.toLowerCase());
            } else {
              candidates.add(lowerS);
            }
          }
        }
        if (r.match_from_profile) {
          const profileVals = this.getProfileValue(profile, r.match_from_profile) || [];
          const valArray = Array.isArray(profileVals) ? profileVals : [profileVals];
          for (const s of valArray) {
            const lowerS = String(s).toLowerCase();
            if (this.synonyms[lowerS]) {
              candidates.add(lowerS);
              for (const syn of this.synonyms[lowerS]) candidates.add(syn.toLowerCase());
            } else {
              candidates.add(lowerS);
            }
          }
        }

        let intersection: string[] = [];
        for (const c of Array.from(candidates)) {
          if (ingTokens.has(c)) intersection.push(c);
        }

        if (intersection.length > 0) {
          matched = true;
          const sub = intersection.sort()[0];
          msg = r.message_template.replace("{matched}", sub);
        }
      }
      // Nutrient comparisons
      else if (r.type === 'nutrient' && r.metric) {
        const val = product.nutrition[r.metric] as number | null | undefined;
        if (val === null || val === undefined) {
          missingData.push(r.metric);
        } else {
          let rhs = r.rhs;
          if (typeof rhs === 'string' && rhs.startsWith('@')) {
            rhs = this.getProfileValue(profile, rhs.substring(1));
          }
          if (this.compare(val, r.op!, rhs as number)) {
            matched = true;
            msg = r.message_template
              .replace("{actual}", val.toFixed(0))
              .replace("{limit}", String(rhs));
          }
        }
      }

      if (matched) {
        if (r.severity === 'hard') hardViolation = true;
        score = Math.max(0.0, score - (r.weights?.penalty || 0.0));
        reasons.push(msg || r.message_template);
        reasonCodes.push(r.id);
      }

      details.push({ id: r.id, type: r.type, severity: r.severity, matched: matched, message: msg, code: r.id });
    }

    // Verdict
    let verdict: 'PASS' | 'CAUTION' | 'FAIL';
    if (hardViolation) {
      verdict = "FAIL";
    } else {
      const strict = (profile.strictness || "balanced").toLowerCase();
      if (strict === "strict") {
        verdict = score >= 95 ? "PASS" : (score >= 80 ? "CAUTION" : "FAIL");
      } else if (strict === "lenient") {
        verdict = score >= 85 ? "PASS" : (score >= 65 ? "CAUTION" : "FAIL");
      } else {
        verdict = score >= 90 ? "PASS" : (score >= 75 ? "CAUTION" : "FAIL");
      }
    }

    if (verdict === "PASS" && reasons.length === 0) {
      reasons.push("This product appears to be consistent with your selected health criteria and general wellness suggestions. It seems like a robust choice for a natural diet.");
    }

    return {
      verdict,
      score: Math.round(score * 10) / 10,
      reasons,
      reason_codes: reasonCodes,
      rule_details: details,
      missing_data: Array.from(new Set(missingData)).sort(),
      version: "ruleset-downsized-1.0"
    };
  }
}

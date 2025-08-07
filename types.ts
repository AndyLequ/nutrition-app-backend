
interface Ingredient {
    id: number;
    name: string;
    image: string;
}

interface IngredientResponse {
    results: Ingredient[];
}

interface NutritionInfo {
    protein: number;
    calories: number;
    carbs: number;
    fat: number;
    amount: number;
    unit: string;
}

interface IngredientSearchParams {
    query: string;
    limit?: number;
    sort?: string;
    sortDirection?: 'asc' | 'desc';
}

interface RecipeSearchParams {
    query: string;
    limit?: number;
    sort?: string;
    sortDirection?: 'asc' | 'desc'
}

interface Recipe {
  id: number;
  title: string;
  image: string;
  [key: string]: any;
}

//FatSecret API types
interface FatSecretFood {
  id: number;
  name: string;
  image: string;
}

interface FatSecretServing {
  protein: string;
  calories: string;
  carbohydrate: string;
  fat: string;
  metric_serving_amount: string;
  metric_serving_unit: string;
}

interface FatSecretRecipe {
  recipe_id: string;
  recipe_name: string;
  recipe_image?: string;
  recipe_url?: string;
  recipe_description?: string;
  ingredients?: {
    ingredient: FatSecretIngredient | FatSecretIngredient[];
  }
  recipe_nutrition?: {
    protein: string;
    calories: string;
    carbohydrate: string;
    fat: string;
  }
  number_of_servings?: string;
}


interface FatSecretIngredient {
  food_id?: string;
  ingredient_name: string;
  ingredient_description: string;
}


export {
    Recipe,
    Ingredient,
    IngredientResponse,
    NutritionInfo,
    IngredientSearchParams,
    RecipeSearchParams,
    FatSecretFood,
    FatSecretServing,
    FatSecretRecipe,
    FatSecretIngredient
}
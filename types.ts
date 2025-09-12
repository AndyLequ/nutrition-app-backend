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
  sortDirection?: "asc" | "desc";
}

interface RecipeSearchParams {
  query: string;
  limit?: number;
  sort?: string;
  sortDirection?: "asc" | "desc";
}

interface Recipe {
  id: number;
  title: string;
  image: string;
  [key: string]: any;
}

//FatSecret API types
interface fatsecretNutritionInfo {
  protein: number;
  calories: number;
  carbs: number;
  fat: number;
  amount: number;
  unit: string;
  description: string;
}

interface FatSecretSearchResponse {
  foods: {
    food: FatSecretFood | FatSecretFood[];
    max_results: number;
    page_number: number;
    total_results: number;
  };
}

interface FatSecretFood {
  id: number;
  name: string;
}

interface FatSecretFoodById {}

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
  };
  recipe_nutrition?: {
    protein: string;
    calories: string;
    carbohydrate: string;
    fat: string;
  };
  number_of_servings?: string;
}

interface FatSecretIngredient {
  food_id?: string;
  ingredient_name: string;
  ingredient_description: string;
}

//EXPERIMENT
// Common interfaces for both foods and recipes
interface BaseItem {
  id: number;
  name: string;
  type: 'food' | 'recipe';
}

interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  amount: number;
  unit: string;
}

interface FoodItem extends BaseItem {
  type: 'food';
  // Additional food-specific properties can go here
}

interface RecipeItem extends BaseItem {
  type: 'recipe';
  nutrition: NutritionInfo;
  categories: string[];
  // Additional recipe-specific properties can go here
}

export interface FatSecretFoodDetails{
  id: string;
  name: string;
  serving: fatsecretNutritionInfo;
  perGram: fatsecretNutritionInfo;
  servingSizeGrams?: number;
}

export interface FatSecretRecipeDetails {
  id: string;
  name: string;
  servingSizeGrams: number;
  nutritionPerServing: NutritionInfo;
  nutritionPerGram: NutritionInfo;
}

type UnifiedItem = FoodItem | RecipeItem;

export {
  BaseItem,
  FoodItem,
  RecipeItem,
  Recipe,
  Ingredient,
  IngredientResponse,
  NutritionInfo,
  IngredientSearchParams,
  RecipeSearchParams,
  fatsecretNutritionInfo,
  FatSecretSearchResponse,
  FatSecretFood,
  FatSecretServing,
  FatSecretRecipe,
  FatSecretIngredient,
};

interface Recipe {
    id: number;
    title: string;
    image: string;
    [key: string]: any; // Adjust based on actual API response
}


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

export {
    Recipe,
    Ingredient,
    IngredientResponse,
    NutritionInfo,
    IngredientSearchParams,
    RecipeSearchParams
}
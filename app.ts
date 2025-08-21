import express, {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";
import {
  Recipe,
  Ingredient,
  NutritionInfo,
  fatsecretNutritionInfo,
  FatSecretFood,
  FatSecretServing,
  FatSecretRecipe,
  FatSecretIngredient,
  FatSecretSearchResponse,
} from "./types";
import axios from "axios";
import { getFatSecretToken } from "./fatsecret";

import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import rateLimit from "express-rate-limit";
const app = express();

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(
  "/api",
  rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later.",
  })
);

//spoonacular URL and params
const spoonacular = axios.create({
  baseURL: "https://api.spoonacular.com",
  params: { apiKey: process.env.SPOONACULAR_API_KEY },
});

// defining routes here

// first section is fatsecret, then next section is spoonacular
app.get("/api/test-fatsecret-token", async (req: Request, res: Response) => {
  try {
    const token = await getFatSecretToken();
    res.json({ token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

//fatsecret food search
app.get("/api/fatsecret/search-foods", async (req: Request, res: Response) => {
  try {
    const { query, maxResults, pageNumber } = req.query;
    if (!query) return res.status(400).json({ error: "Missing search query" });

    //Get OAuth 2.0 access token
    const token = await getFatSecretToken();

    const params = new URLSearchParams();
    params.append("method", "foods.search");
    params.append("search_expression", query as string);
    params.append("format", "json");

    if (maxResults) params.append("max_results", String(maxResults));
    if (pageNumber) params.append("page_number", String(pageNumber));

    const response = await axios.get(
      "https://platform.fatsecret.com/rest/server.api",
      {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    let foodData = response.data.foods?.food;

    let foods = Array.isArray(foodData) ? foodData : [foodData];

    if (!foodData) {
      foodData = [];
    } else if (!Array.isArray(foodData)) {
      foodData = [foodData];
    }

    const result = foods.map((food: any) => ({
      id: parseInt(food.food_id) || 0,
      name: food.food_name || "Unknown Food",
    }));

    res.json(result);
  } catch (error: any) {
    console.error("API Error:", error.response?.data || error.message);

    res.status(500).json({
      error: "Failed to fetch food data from fatsecret",
    });
  }
});

/*  response structure example for specific food nutrition */
/* {
    "id":"1234",
    "name":"Tiramisu",
    "protein":4.77,
    "calories":283,
    "carbs":24.41,
    "fat":18.2,
    "amount":100,
    "unit":"100.000"
    } */
// get food by id fatsecret

app.get("/api/fatsecret/food/:id", async (req: Request, res: Response) => {
  const foodId = req.params.id;

  try {
    const token = await getFatSecretToken();

    const response = await axios.get(
      "https://platform.fatsecret.com/rest/food/v4",
      {
        params: {
          method: "food.get",
          food_id: foodId,
          format: "json",
        },
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const foodData = response.data?.food;
    if (!foodData) {
      return res.status(404).json({ error: "Food not found" });
    }

    const nutritionInfo = mapFoodToNutritionInfo(response.data);
    res.json({
      id: foodId,
      name: foodData.food_name,
      ...nutritionInfo,
    });
  } catch (error: any) {
    console.error("api error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to fetch food data",
      details: error.response?.data || error.message,
    });
  }
});

// recipe search fatsecret
app.get("/api/fatsecret/recipes", async (req: Request, res: Response) => {
  const { query, maxResults = 3, pageNumber = 0 } = req.query;

  try {
    const token = await getFatSecretToken();

    const params = new URLSearchParams({
      search_expressions: query as string,
      format: "json",
      max_results: maxResults.toString(),
      page_number: pageNumber.toString(),
    });

    const response = await axios.get(
      "https://platform.fatsecret.com/rest/recipes/search/v3",
      {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const recipes = response.data.recipes.recipe;

    // deal with this later, need to figure out if I want to map the data here or just let it return only the results names
    const mappedRecipes: FatSecretRecipe[] = recipes.map((recipe: any) => ({
      recipe_id: Number(recipe.recipe_id),
      recipe_name: recipe.recipe_name,
      recipe_nutrition: {
        calories: Number(recipe.recipe_nutrition?.calories),
        protein: Number(recipe.recipe_nutrition?.protein),
        carbs: Number(recipe.recipe_nutrition?.carbohydrate),
        fat: Number(recipe.recipe_nutrition?.fat),
        amount: 1,
        unit: "serving",
      },
      types: recipe.recipe_types?.recipe_type || [],
    }));

    res.json(mappedRecipes);
  } catch (error: any) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch FatSecret recipes" });
  }
});

app.get("/api/fatsecret/recipe/:id", async (req: Request, res: Response) => {
  try {
    const recipeId = req.params.id;
    const token = await getFatSecretToken();

    const response = await axios.get(
      "https://platform.fatsecret.com/rest/recipe/v2",
      {
        params: {
          method: "recipe.get",
          recipe_id: recipeId,
          format: "json",
        },
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    // initializing recipe so that i can make my macronutrient per gram work below
    const recipe = response.data?.recipe;
    if (!recipe) {
      throw new Error("Recipe data not found in API response");
    }

    /* Replacing the recipe /information endpoint here 
        Calculate nutrients per gram:
          *Find the number of servings
          *Find the metric serving amount
          *Find the nutrients per serving
          *Find the total grams of the recipe
      */
    const servings = parseInt(recipe.number_of_servings) || 1;

    // Fallback if total_weight_grams is missing
    let servingSizeGrams = 100; //default fallback value
    if (recipe.total_recipe_weights?.total_weight_grams) {
      const totalGrams = parseFloat(
        recipe.total_recipe_weights.total_weight_grams
      );
      servingSizeGrams = totalGrams / servings;
    }

    /* Get nutrition data (replaces /nutrition)  */
    const nutritionPerServing = mapRecipeToNutritionInfo(response.data);

    // Combine the responses
    const result = {
      // from information endpoint
      servings,
      servingSizeGrams,
      protein: nutritionPerServing.protein,
      calories: nutritionPerServing.calories,
      carbs: nutritionPerServing.carbs,
      fat: nutritionPerServing.fat,
      amount: 1,
      unit: "serving",
    };

    res.json(result);
  } catch (error: any) {
    console.error("api error:", error.response?.data || error.message);
    res.status(500).json({
      error: error.message,
      details: error.response?.data || null,
    });
  }
});

// helper function to map API response to NutritionInfo
// used for fatsecret endpoints

// this one here is for food items returned from fatsecret
function mapFoodToNutritionInfo(apiData: any): {
  servingNutrition: NutritionInfo;
  perGramNutrition: NutritionInfo;
} {
  const food = apiData?.food || {};
  const servings = food?.servings?.serving || [];

  const servingsArray = Array.isArray(servings) ? servings : [servings];

  if (servingsArray.length === 0) {
    throw new Error("No serving information found");
  }

  // finding 100g serving or use the first available serving
  const preferredServing =
    servingsArray.find(
      (serving) =>
        serving.metric_serving_amount === "100.00" &&
        serving.metric_serving_unit === "g"
    ) ||
    servingsArray.find((serving) => serving.metric_serving_unit === "g") ||
    servingsArray[0];

  const servingAmount = parseFloat(preferredServing.metric_serving_amount) || 0;

  // Extract base nutrition values for the serving
  const servingNutrition = {
    protein: parseFloat(preferredServing.protein) || 0,
    calories: parseFloat(preferredServing.calories) || 0,
    carbs: parseFloat(preferredServing.carbohydrate) || 0,
    fat: parseFloat(preferredServing.fat) || 0,
    amount: servingAmount,
    unit: preferredServing.metric_serving_unit || "g",
    description: preferredServing.serving_description || "",
  };

  // calculating per gram values(if serving amount is valid)
  let perGramNutrition: NutritionInfo;

  // Extract and convert nutrition values, then divide by serving amount to get per gram
  if (servingAmount > 0 && preferredServing.metric_serving_unit === "g") {
    perGramNutrition = {
      protein: servingNutrition.protein / servingAmount,
      calories: servingNutrition.calories / servingAmount,
      carbs: servingNutrition.carbs / servingAmount,
      fat: servingNutrition.fat / servingAmount,
      amount: 1,
      unit: "g",
      description: "Per gram",
    };
  } else {
    // if can't calculate per gram, just return the serving nutrition with a note
    perGramNutrition = {
      ...servingNutrition,
      description: "Cannot calculate per gram values - serving not in grams",
    };
  }

  return {
    servingNutrition,
    perGramNutrition,
  };
}

// this one is to map returned recipe data to nutrition info
function mapRecipeToNutritionInfo(apiData: any): NutritionInfo {
  const recipe = apiData?.recipe;

  if (!recipe) {
    throw new Error("Missing recipe data");
  }

  // handle different serving formats (array vs single object)
  let servings = recipe.serving_sizes?.serving;
  if (servings && !Array.isArray(servings)) {
    servings = [servings];
  }

  // find any gram-based serving
  const gramServing = servings?.find((s: any) => s.metric_serving_unit === "g");

  if (gramServing) {
    // Extract and convert nutrition values
    return {
      protein: parseFloat(gramServing.protein) || 0,
      calories: parseFloat(gramServing.calories) || 0,
      carbs: parseFloat(gramServing.carbohydrate) || 0,
      fat: parseFloat(gramServing.fat) || 0,
      amount: parseFloat(gramServing.metric_serving_amount) || 0,
      unit: "g",
    };
  }

  // fallback to first available serving
  const firstServing = servings?.[0];
  if (!firstServing) throw new Error("No serving data found");

  return {
    protein: parseFloat(firstServing.protein) || 0,
    calories: parseFloat(firstServing.calories) || 0,
    carbs: parseFloat(firstServing.carbohydrate) || 0,
    fat: parseFloat(firstServing.fat) || 0,
    amount: parseFloat(firstServing.metric_serving_amount) || 0,
    unit: firstServing.metric_serving_unit || "serving",
  };
}

//
// Spoonacular Endpoints //
//
//test
app.get("/recipes", (_req, res) => {
  res.json({ message: "Hello from the server!" });
});

app.get("/api/ingredients", async (req: Request, res: Response) => {
  const {
    query,
    limit = "3",
    sort = "calories",
    sortDirection = "desc",
  } = req.query;

  try {
    const { data } = await spoonacular.get<{ results: Ingredient[] }>(
      "/food/ingredients/search",
      {
        params: {
          query,
          number: limit,
          sort,
          sortDirection,
        },
      }
    );
    res.json(data.results);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching ingredients");
  }
});

app.get("/api/recipes", async (req: Request, res: Response) => {
  const {
    query,
    limit = "3",
    sort = "calories",
    sortDirection = "desc",
  } = req.query;
  try {
    const { data } = await spoonacular.get<{ results: Recipe[] }>(
      "/recipes/complexSearch",
      {
        params: { query, number: limit, sort, sortDirection },
      }
    );
    res.json(data.results);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching recipes");
  }
});

// response structure example for ingredients nutrition
/* {
    "name":"apple",
    "protein":0.26,
    "calories":52,
    "carbs":13.8,
    "fat":0.17,
    "amount":100,
    "unit":"gram"
} */

app.get(
  "/api/ingredients/:id/nutrition",
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { amount, unit } = req.query;
    try {
      const { data } = await spoonacular.get(
        `/food/ingredients/${id}/information`,
        {
          params: { amount, unit },
        }
      );

      const nutrients = data.nutrition.nutrients;

      const response: NutritionInfo & { name: string } = {
        name: data.name,
        protein: nutrients.find((n: any) => n.name === "Protein")?.amount || 0,
        calories:
          nutrients.find((n: any) => n.name === "Calories")?.amount || 0,
        carbs:
          nutrients.find((n: any) => n.name === "Carbohydrates")?.amount || 0,
        fat: nutrients.find((n: any) => n.name === "Fat")?.amount || 0,
        amount: Number(amount),
        unit: unit as string,
      };

      res.json(response);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error fetching ingredient nutrition");
    }
  }
);

app.get("/api/recipes/:id/information", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data } = await spoonacular.get(`/recipes/${id}/information`);
    res.json({
      servings: data.servings,
      servingSizeGrams: data.nutrition?.weightPerServing?.amount || 100,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching recipe info");
  }
});

app.get("/api/recipes/:id/nutrition", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data } = await spoonacular.get(
      `/recipes/${id}/nutritionWidget.json`
    );
    res.json({
      protein: parseFloat(data.protein.replace(/[^\d.]/g, "")),
      calories: parseFloat(data.calories.replace(/[^\d.]/g, "")),
      carbs: parseFloat(data.carbs.replace(/[^\d.]/g, "")),
      fat: parseFloat(data.fat.replace(/[^\d.]/g, "")),
      amount: 1,
      unit: "serving",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching recipe nutrition");
  }
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
});

export default app;

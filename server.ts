import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

//new code for fatsecret
import OAuth from 'oauth-2.0a';
import crypto from 'crypto'

dotenv.config();

const app = express();
const PORT = process.env.PORT || '3000';

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

const corsOptions = {
  origin: '*', // Allow all origins
  methods: ['GET'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

const spoonacular = axios.create({
  baseURL: 'https://api.spoonacular.com',
  params: { apiKey: process.env.SPOONACULAR_API_KEY }
});

//FatSecret URL: oauth2 specific
const FATSECRET_URL = 'https://platform.fatsecret.com/rest/server.api'
const FATSECRET_KEY = process.env.CLIENT_SECRET_KEY 

const fatsecret = axios.create({
  baseURL: 'https://platform.fatsecret.com/rest',
  params: { apiKey: FATSECRET_KEY}

})



// Types
interface Ingredient {
  id: number;
  name: string;
  image: string;
}

interface Recipe {
  id: number;
  title: string;
  image: string;
  [key: string]: any;
}

interface NutritionInfo {
  protein: number;
  calories: number;
  carbs: number;
  fat: number;
  amount: number;
  unit: string;
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

//helper function to sing requests
const signRequest = (
  method: 'POST' | 'GET',
  url: string,
  data: Record<string, string | number>

) => {
  const request = {
    url, 
    method, 
    data: {...data,format: 'json'}
  }

let accessToken = null;
let tokenExpiration = 0;

//helper function to get access token
async function getAccessToken() {
  if(accessToken && Date.now() < tokenExpiration){
    return accessToken
  }

  try{
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('scope','basic');

    const response = await axios.post(TOKEN_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
      }
    })

    accessToken = response.data.access_token;
    tokenExpiration = Date.now() = (response.data.expires_in * 1000) - 300000;

    return accessToken;
  } catch (error){
    console.error('Token Error:', error.response?.data || error.message);
    throw new Error('Failed to obtain access token')
  }
}

// header stuff for fatsecret OAuth
const headers = OAuth.toHeader(OAuth.authorize(request));
return {
  url: request.url,
  method: request.method,
  data: request.data,
  headers: {
    ...headers,
    'Content-Type': 'application/x-www-form-urlencoded'
    }
  }
}


// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use('/api', limiter);

// Endpoints

//test
app.get("/recipes", (_req, res) => {
  res.json({ message: "Hello from the server!" });
});


app.get('/api/ingredients', async (req: Request, res: Response) => {
  const { query, limit = '3', sort = 'calories', sortDirection = 'desc' } = req.query;


  try {
    const { data } = await spoonacular.get<{ results: Ingredient[] }>('/food/ingredients/search', {
      params: {
        query,
        number: limit,
        sort,
        sortDirection
      }
    });
    res.json(data.results);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching ingredients');
  }
});

app.get('/api/recipes', async (req: Request, res: Response) => {
  const { query, limit = '3', sort = 'calories', sortDirection = 'desc' } = req.query;
  try {
    const { data } = await spoonacular.get<{ results: Recipe[] }>('/recipes/complexSearch', {
      params: { query, number: limit, sort, sortDirection }
    });
    res.json(data.results);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching recipes');
  }
});

app.get('/api/ingredients/:id/nutrition', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, unit } = req.query;
  try {
    const { data } = await spoonacular.get(`/food/ingredients/${id}/information`, {
      params: { amount, unit }
    });

    const nutrients = data.nutrition.nutrients;

    const response: NutritionInfo & { name: string } = {
      name: data.name,
      protein: nutrients.find((n: any) => n.name === 'Protein')?.amount || 0,
      calories: nutrients.find((n: any) => n.name === 'Calories')?.amount || 0,
      carbs: nutrients.find((n: any) => n.name === 'Carbohydrates')?.amount || 0,
      fat: nutrients.find((n: any) => n.name === 'Fat')?.amount || 0,
      amount: Number(amount),
      unit: unit as string
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching ingredient nutrition');
  }
});

app.get('/api/recipes/:id/information', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data } = await spoonacular.get(`/recipes/${id}/information`);
    res.json({
      servings: data.servings,
      servingSizeGrams: data.nutrition?.weightPerServing?.amount || 100
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching recipe info');
  }
});


//fatsecret food search
app.get('/api/search-foods', async(req, res) => {
  try {
    const {query, maxResults, pageNumber} = req.query;
    if(!query) return res.status(400).json({error: 'Missing search query'});

    //Get OAuth 2.0 access token
    const token = await getAccessToken();

    //API request parameters
    const params = {
      method: 'foods.search',
      search_expression: query, 
      format: 'json',
      max_results: maxResults || 20,
      page_number: pageNumber || 0
    };

    const response = await axios.get(API_URL, {
      params,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })

    res.json(response.data)

  } catch(error: any){
    console.error('API Error:', error.response?.data || error.message)

    if(error.response?.status === 401){
      accessToken = null;
    }

    res.status(500).json({
      error: 'Failed to fetch food data',
      details: error.response?.data || error.message
    })

  }
})

app.get('/api/recipes/:id/nutrition', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data } = await spoonacular.get(`/recipes/${id}/nutritionWidget.json`);
    res.json({
      protein: parseFloat(data.protein.replace(/[^\d.]/g, "")),
      calories: parseFloat(data.calories.replace(/[^\d.]/g, "")),
      carbs: parseFloat(data.carbs.replace(/[^\d.]/g, "")),
      fat: parseFloat(data.fat.replace(/[^\d.]/g, "")),
      amount: 1,
      unit: "serving"
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching recipe nutrition');
  }
});

//** new endpoints for fatsecret BELOW **//

app.get('/api/ingredients/search', async (req: Request, res: Response) => {
  try{
    const {query, max_results = '10', page = '0'} = req.query;
    if(!query) return res.status(400).json({error: "Query parameter is required"})

    const signedRequest = signRequest('POST', FATSECRET_URL, {
      method: 'foods.search',
      search_expression: query as string,
      max_results: parseInt(max_results as string),
      page_number: parseInt(page as string)
    });


    const response = await axios.post(
      signedRequest.url,
      signedRequest.data,
      {headers: signedRequest.headers}
    )

    //type-safe mapping to Ingredient[]
    const foods = response.data?.foods?.food;
    const ingredients: Ingredient[] = Array.isArray(foods)
      ? foods.map((food: any) => ({
        id: parseInt(food.food_id),
        name: food.food_name,
        image: food.food_image || ''
      }))
      : foods
        ? [{
          id: parseInt(foods.food_id),
          name: foods.food_name,
          image: foods.food_image || ''
        }]
        : [];

      res.json(ingredients);
  } catch(error: any){
    res.status(500).json({error: error.message})
  }
})

app.get('/api/ingredients/:id', async(req: Request, res: Response) => {
  try{
    const foodId = req.params.id;
    const signedRequest = signRequest('POST', FATSECRET_URL, {
      method: 'food.get',
      food_id: foodId
    })

    const response = await axios.post(
      signedRequest.url,
      signedRequest.data,
      {headers: signedRequest.headers}
    )

    const food: FatSecretFood = response.data?.food;
    if(!food) return res.status(404).json({error: "Food item not found"})

    //Handle serving types
    let serving: FatSecretServing | undefined;
    if(Array.isArray(food.servings.serving)){
      serving = food.servings.serving[0];

    } else if(food.servings.serving){
      serving = food.servings.serving
    }

    //Map to NutritionInfo
    const nutrition: NutritionInfo | null = serving ? {
      protein: parseFloat(serving.protein) || 0,
      calories: parseFloat(serving.calories) || 0,
      carbs: parseFloat(serving.carbohydrate) || 0,
      fat: parseFloat(serving.fat) || 0,
      amount: parseFloat(serving.metric_serving_amount) || 0,
      unit: serving.metric_serving_unit || 'g'
    } : null;

    //create Recipe-compatible response
    const result: Recipe = {
      id: parseInt(food.food_id),
      title: food.food_name,
      image: food.food_image || '',
      nutrition,
      rawData: food
    }

    res.json(result)
  } catch(error: any){
    res.status(500).json({error: error.message})
  }
})

//recipe endpoints for fatsecret
app.get('/api/recipes/search', async(req: Request, res: Response) => {
  try {
    const {query, max_results = '10', page = '0'} = req.query;
    if(!query) return res.status(400).json({error: "Query parameter is required"})

      const signedRequest = signRequest('POST', FATSECRET_URL,{
        method: 'recipes.search',
        search_expression: parseInt(max_results as string),
        page_number: parseInt(page as string)
      })

      const response = await axios.post(
        signedRequest.url,
        signedRequest.data,
        {headers: signedRequest.headers}
      )

      const recipesData = response.data?.recipes?.recipe;
      const recipes: Recipe[] = Array.isArray(recipesData)
        ? recipesData.map((recipe: any) => ({
          id: parseInt(recipe.recipe_id),
          title: recipe.recipe_name,
          image: recipe.recipe_image || '',
          url: recipe.recipe_url,
          description: recipe.recipe_description || ''
        }))
        :recipesData
          ? [{
            id: parseInt(recipesData.recipe_id),
            title: recipesData.recipe_name,
            image: recipesData.recipe_image || '',
            url: recipesData.recipe_url,
            description: recipesData.recipe_description || ''
          }]
          : []

          res.json(recipes);
  } catch (error: any){
    res.status(500).json({error: error.message})
  }
})

app.get('/api/recipes/:id', async (req: Request, res: Response) => {
  try{
    const recipeId = req.params.id;
    const signedRequest = signRequest('POST', FATSECRET_URL, {
      method: 'recipe.get',
      recipe_id: recipeId
    })

    const response = await axios.post(
      signedRequest.url,
      signedRequest.data,
      { headers: signedRequest.headers}
    )

    const recipeData: FatSecretRecipe = response.data?.recipe;
    if(!recipeData) return res.status(404).json({error: "Recipe not found"});

    //process ingredients
    let ingredients: Ingredient[] = [];
    if(recipeData.ingredients?.ingredient){
      const ingredientList = Array.isArray(recipeData.ingredients.ingredient)
        ? recipeData.ingredients.ingredient
        : [recipeData.ingredients.ingredient]

        ingredients = ingredientList.map(ing => ({
          id: ing.food_id ? parseInt(ing.food_id) : 0,
          name: ing.ingredient_description || ing.ingredient_name,
          image: ''
        }))
    }

    const nutrition: NutritionInfo | null = recipeData.recipe_nutrition
      ? {
        protein: parseFloat(recipeData.recipe_nutrition.protein) || 0,
        calories: parseFloat(recipeData.recipe_nutrition.calories) || 0,
        carbs: parseFloat(recipeData.recipe_nutrition.carbohydrate) || 0,
        fat: parseFloat(recipeData.recipe_nutrition.fat) || 0,
        amount: 1,
        unit: 'serving'
      }
      : null;

    const recipe: Recipe = {
      id: parseInt(recipeData.recipe_id),
      title: recipeData.recipe_name,
      image: recipeData.recipe_image || '',
      ingredients,
      nutrition,
      servings: recipeData.number_of_servings || '',
      rawData: recipeData
    }

    res.json(recipe);

  } catch(error:any){
    res.status(500).json({error: error.message})
  }
})


app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

app.listen(PORT,  () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

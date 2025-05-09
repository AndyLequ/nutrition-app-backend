import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || '3000';

const spoonacular = axios.create({
  baseURL: 'https://api.spoonacular.com',
  params: { apiKey: process.env.SPOONACULAR_API_KEY }
});

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

// Middleware
app.use(express.json());

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

app.listen(PORT,  () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

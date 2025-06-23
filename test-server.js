const axios = require("axios");

// Test configuration
const BASE_URL = "http://localhost:3000";
const TEST_INGREDIENT = "apple";
const TEST_RECIPE = "pasta";
const TEST_INGREDIENT_ID = 9266; // Apple ID
const TEST_RECIPE_ID = 716429; // Pasta recipe ID

async function runTests() {
  try {
    // 1. Test basic endpoint
    console.log("Testing basic endpoint:");
    const basicResponse = await axios.get(`${BASE_URL}/recipes`);
    console.log("✅ Basic test passed:", basicResponse.data);

    // 2. Test ingredients search
    console.log("\nTesting ingredients search:");
    const ingredientsResponse = await axios.get(`${BASE_URL}/api/ingredients`, {
      params: { query: TEST_INGREDIENT, limit: 1 },
    });
    console.log("✅ Ingredients search passed:", ingredientsResponse.data);

    // 3. Test recipes search
    console.log("\nTesting recipes search:");
    const recipesResponse = await axios.get(`${BASE_URL}/api/recipes`, {
      params: { query: TEST_RECIPE, limit: 1 },
    });
    console.log("✅ Recipes search passed:", recipesResponse.data);

    // 4. Test ingredient nutrition
    console.log("\nTesting ingredient nutrition:");
    const nutritionResponse = await axios.get(
      `${BASE_URL}/api/ingredients/${TEST_INGREDIENT_ID}/nutrition`,
      {
        params: { amount: 100, unit: "g" },
      }
    );
    console.log("✅ Ingredient nutrition passed:", nutritionResponse.data);

    // 5. Test recipe information
    console.log("\nTesting recipe information:");
    const recipeInfoResponse = await axios.get(
      `${BASE_URL}/api/recipes/${TEST_RECIPE_ID}/information`
    );
    console.log("✅ Recipe information passed:", recipeInfoResponse.data);

    // 6. Test recipe nutrition
    console.log("\nTesting recipe nutrition:");
    const recipeNutritionResponse = await axios.get(
      `${BASE_URL}/api/recipes/${TEST_RECIPE_ID}/nutrition`
    );
    console.log("✅ Recipe nutrition passed:", recipeNutritionResponse.data);

    console.log("\n🎉 All tests passed successfully!");
  } catch (error) {
    console.error(
      "❌ Test failed:",
      error.response ? error.response.data : error.message
    );
    process.exit(1);
  }
}

runTests();

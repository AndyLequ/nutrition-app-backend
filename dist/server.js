"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cors_1 = __importDefault(require("cors"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || '3000';
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later.'
});
const corsOptions = {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
const spoonacular = axios_1.default.create({
    baseURL: 'https://api.spoonacular.com',
    params: { apiKey: process.env.SPOONACULAR_API_KEY }
});
// Middleware
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use('/api', limiter);
// Endpoints
//test
app.get("/recipes", (_req, res) => {
    res.json({ message: "Hello from the server!" });
});
app.get('/api/ingredients', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { query, limit = '3', sort = 'calories', sortDirection = 'desc' } = req.query;
    try {
        const { data } = yield spoonacular.get('/food/ingredients/search', {
            params: {
                query,
                number: limit,
                sort,
                sortDirection
            }
        });
        res.json(data.results);
    }
    catch (error) {
        console.error(error);
        res.status(500).send('Error fetching ingredients');
    }
}));
app.get('/api/recipes', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { query, limit = '3', sort = 'calories', sortDirection = 'desc' } = req.query;
    try {
        const { data } = yield spoonacular.get('/recipes/complexSearch', {
            params: { query, number: limit, sort, sortDirection }
        });
        res.json(data.results);
    }
    catch (error) {
        console.error(error);
        res.status(500).send('Error fetching recipes');
    }
}));
app.get('/api/ingredients/:id/nutrition', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const { id } = req.params;
    const { amount, unit } = req.query;
    try {
        const { data } = yield spoonacular.get(`/food/ingredients/${id}/information`, {
            params: { amount, unit }
        });
        const nutrients = data.nutrition.nutrients;
        const response = {
            name: data.name,
            protein: ((_a = nutrients.find((n) => n.name === 'Protein')) === null || _a === void 0 ? void 0 : _a.amount) || 0,
            calories: ((_b = nutrients.find((n) => n.name === 'Calories')) === null || _b === void 0 ? void 0 : _b.amount) || 0,
            carbs: ((_c = nutrients.find((n) => n.name === 'Carbohydrates')) === null || _c === void 0 ? void 0 : _c.amount) || 0,
            fat: ((_d = nutrients.find((n) => n.name === 'Fat')) === null || _d === void 0 ? void 0 : _d.amount) || 0,
            amount: Number(amount),
            unit: unit
        };
        res.json(response);
    }
    catch (error) {
        console.error(error);
        res.status(500).send('Error fetching ingredient nutrition');
    }
}));
app.get('/api/recipes/:id/information', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    try {
        const { data } = yield spoonacular.get(`/recipes/${id}/information`);
        res.json({
            servings: data.servings,
            servingSizeGrams: ((_b = (_a = data.nutrition) === null || _a === void 0 ? void 0 : _a.weightPerServing) === null || _b === void 0 ? void 0 : _b.amount) || 100
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).send('Error fetching recipe info');
    }
}));
app.get('/api/recipes/:id/nutrition', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const { data } = yield spoonacular.get(`/recipes/${id}/nutritionWidget.json`);
        res.json({
            protein: parseFloat(data.protein.replace(/[^\d.]/g, "")),
            calories: parseFloat(data.calories.replace(/[^\d.]/g, "")),
            carbs: parseFloat(data.carbs.replace(/[^\d.]/g, "")),
            fat: parseFloat(data.fat.replace(/[^\d.]/g, "")),
            amount: 1,
            unit: "serving"
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).send('Error fetching recipe nutrition');
    }
}));
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
});
app.listen(PORT, () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const { MongoClient, ObjectId } = require('mongodb');

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

const PORT = 3000;

// OpenAI Configuration
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


// MongoDB configuration
const mongoURI = process.env.MONGODB_URL;
const dbName = 'todos';
const collectionName = 'notes';
let db, collection;

// Connect to MongoDB
MongoClient.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then((client) => {
        db = client.db(dbName);
        collection = db.collection(collectionName);
        console.log('Connected to MongoDB');
    })
    .catch((err) => console.error('Error connecting to MongoDB:', err));

app.use(bodyParser.json());

// Get all todos
app.get('/api/todos', async (req, res) => {
    try {
        const todos = await collection.find().toArray();
        res.json(todos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new todo
app.post('/api/todos', async (req, res) => {
    try {
        const todo = { text: req.body.text, done: false };
        const result = await collection.insertOne(todo);
        const createdTodo = { ...todo, id: result.insertedId }; // Include the generated ID
        res.json(createdTodo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//Update todo
app.patch('/api/todos/:id', async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;

    try {
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { text: text } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send("Task not found");
        }

        res.status(200).send("Task updated successfully");
    } catch (err) {
        console.error("Error updating task:", err);
        res.status(500).send("Server error");
    }
});



// Delete a todo
app.delete('/api/todos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Todo not found' });
        }
        res.json({ message: 'Todo deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

//Search notes
app.get('/api/todos/search', async (req, res) => {
    const { query } = req.query;

    try {
        // Generate embedding for the query using OpenAI API
        const response = await axios.post(
            'https://api.openai.com/v1/embeddings',
            {
                model: 'text-embedding-ada-002',
                input: query
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                }
            }
        );

        const embedding = response.data.data[0].embedding;


        // Perform vector search in MongoDB
        const results = await collection.aggregate([
            {
                $vectorSearch: {
                    index: "todoNotes",
                    path: "embedding",
                    queryVector: embedding,
                    numCandidates: 100,
                    limit: 3

                }             
            },
            {
                $project: {
                    _id: 1,
                    text: 1,
                    //score: { $meta: "vectorSearchScore" }  // Include the similarity score
                }
            }
        ]).toArray();

        res.json(results);
    } catch (err) {
        console.error('Search error:', err.message);
        res.status(500).json({ error: 'Failed to perform vector search' });

    }
});

// Utility to calculate theme from embeddings
async function calculateThemes() {
    const tasks = await collection.find({ embedding: { $exists: true } }).toArray();

    if (tasks.length === 0) return [];

    const embeddings = tasks.map(task => task.embedding);

    // Cluster embeddings to generate themes (simplified example)
    const themeMap = new Map();

    for (let task of tasks) {
        const theme = task.text.split(" ")[0];  // Naive theme extraction
        themeMap.set(theme, (themeMap.get(theme) || 0) + 1);
    }

    const sortedThemes = Array.from(themeMap.entries()).sort((a, b) => b[1] - a[1]);
    return sortedThemes.slice(0, 5).map(([theme]) => theme);
}

// Endpoint to get common themes
app.get('/api/themes', async (req, res) => {
    try {
        const themes = await calculateThemes();
        res.json(themes);
    } catch (error) {
        console.error("Error fetching themes:", error);
        res.status(500).json({ error: "Failed to fetch themes" });
    }
});

// Endpoint to get tasks by theme
app.get('/api/todos/:theme', async (req, res) => {
    try {
        const theme = req.params.theme;
        const tasks = await collection.find({ text: { $regex: `^${theme}`, $options: 'i' } }).toArray();
        res.json(tasks);
    } catch (error) {
        console.error("Error fetching tasks by theme:", error);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
});
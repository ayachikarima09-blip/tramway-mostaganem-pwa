const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('public'));

// MongoDB Connection
let db;
let observationsCollection;

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'tramway_db';

MongoClient.connect(MONGO_URI)
    .then(client => {
        console.log('✅ Connecté à MongoDB');
        db = client.db(DB_NAME);
        observationsCollection = db.collection('observations');

        // Créer des index pour améliorer les performances
        observationsCollection.createIndex({ created_at: -1 });
        observationsCollection.createIndex({ lieu_station: 1 });
        observationsCollection.createIndex({ date: 1 });
    })
    .catch(err => {
        console.error('❌ Erreur de connexion MongoDB:', err);
        process.exit(1);
    });

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
    if (db) {
        res.json({ status: 'OK', message: 'Serveur connecté à MongoDB' });
    } else {
        res.status(503).json({ status: 'ERROR', message: 'Base de données non disponible' });
    }
});

// GET - Récupérer toutes les observations
app.get('/api/observations', async (req, res) => {
    try {
        const observations = await observationsCollection
            .find({})
            .sort({ created_at: -1 })
            .toArray();

        console.log(`📖 GET: ${observations.length} observations récupérées`);
        res.json({ observations });
    } catch (error) {
        console.error('❌ Erreur GET:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Récupérer une observation par ID
app.get('/api/observations/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const observation = await observationsCollection.findOne({
            _id: new ObjectId(id)
        });

        if (!observation) {
            return res.status(404).json({ error: 'Observation non trouvée' });
        }

        console.log(`📖 GET: Observation ${id} récupérée`);
        res.json(observation);
    } catch (error) {
        console.error('❌ Erreur GET:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Créer nouvelle observation
app.post('/api/observations', async (req, res) => {
    try {
        const observation = req.body;

        // Ajouter timestamps et versioning
        const now = new Date().toISOString();
        observation.created_at = observation.created_at || now;
        observation.updated_at = now;
        observation.version = 1;

        // Si l'observation a déjà un _id, vérifier s'il existe
        if (observation._id) {
            try {
                const existing = await observationsCollection.findOne({
                    _id: new ObjectId(observation._id)
                });

                if (existing) {
                    // Déjà existe → rediriger vers mise à jour
                    console.log(`⚠️ POST: Observation ${observation._id} existe déjà, mise à jour`);
                    req.params.id = observation._id;
                    return handleUpdate(req, res);
                }
            } catch (err) {
                // Si l'ID n'est pas un ObjectId valide, continuer avec l'insertion
                console.log('⚠️ ID invalide, création d\'une nouvelle observation');
            }
        }

        // Retirer _id pour laisser MongoDB le générer
        delete observation._id;
        delete observation.id;

        const result = await observationsCollection.insertOne(observation);

        console.log(`✅ POST: Nouvelle observation créée ${result.insertedId}`);
        res.status(201).json({
            success: true,
            _id: result.insertedId,
            version: 1
        });

    } catch (error) {
        console.error('❌ Erreur POST:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== FONCTION DE MISE À JOUR ====================
async function handleUpdate(req, res) {
    try {
        const id = req.params.id;

        // ⚠️ VALIDATION: Vérifier si l'ID est temporaire ou invalide
        if (!id || id.startsWith('temp_') || id.length !== 24) {
            console.log(`⚠️ UPDATE refusé: ID invalide "${id}"`);
            return res.status(400).json({ 
                error: 'ID invalide. Utilisez POST pour créer une nouvelle observation.' 
            });
        }

        const updates = req.body;

        // Récupérer version actuelle
        const existing = await observationsCollection.findOne({
            _id: new ObjectId(id)
        });

        if (!existing) {
            return res.status(404).json({ error: 'Observation non trouvée' });
        }

        // Incrémenter version
        const newVersion = (existing.version || 0) + 1;
        const now = new Date().toISOString();

        // Nettoyer les champs système
        delete updates._id;
        delete updates.id;

        // Mettre à jour
        const result = await observationsCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    ...updates,
                    updated_at: now,
                    version: newVersion
                }
            }
        );

        console.log(`✅ UPDATE: Observation ${id} mise à jour (v${existing.version || 0} → v${newVersion})`);
        res.json({
            success: true,
            modified: result.modifiedCount,
            version: newVersion,
            _id: id
        });

    } catch (error) {
        console.error('❌ Erreur UPDATE:', error);
        res.status(500).json({ error: error.message });
    }
}

// PUT/PATCH - Routes de mise à jour
app.put('/api/observations/:id', handleUpdate);
app.patch('/api/observations/:id', handleUpdate);

// DELETE - Supprimer une observation
app.delete('/api/observations/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await observationsCollection.deleteOne({
            _id: new ObjectId(id)
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Observation non trouvée' });
        }

        console.log(`🗑️ DELETE: Observation ${id} supprimée`);
        res.json({ success: true, deleted: result.deletedCount });
    } catch (error) {
        console.error('❌ Erreur DELETE:', error);
        res.status(500).json({ error: error.message });
    }
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});

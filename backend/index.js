const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { MongoClient, ObjectId } = require('mongodb')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

// ═══════════════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════════════

app.use(cors())
app.use(bodyParser.json({ limit: '50mb' }))
app.use(express.static('public'))

// ═══════════════════════════════════════════════════════════════════════════════════════
// MONGODB CONNECTION
// ═══════════════════════════════════════════════════════════════════════════════════════

let db
let observationsCollection

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017'
const DB_NAME = 'tramwaydb'

MongoClient.connect(MONGO_URI)
  .then(client => {
    console.log('Connecté à MongoDB')
    db = client.db(DB_NAME)
    observationsCollection = db.collection('observations')

    // Créer des index pour améliorer les performances
    observationsCollection.createIndex({ created_at: -1 })
    observationsCollection.createIndex({ lieu_station: 1 })
    observationsCollection.createIndex({ date: 1 })
  })
  .catch(err => {
    console.error('Erreur de connexion MongoDB:', err)
    process.exit(1)
  })

// ═══════════════════════════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════════════

// Vérifier si un ID est un ObjectId MongoDB valide (24 caractères hexadécimaux)
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') return false
  return /^[0-9a-fA-F]{24}$/.test(id)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════════════

// Health check
app.get('/api/health', (req, res) => {
  if (db) {
    res.json({ status: 'OK', message: 'Serveur connecté à MongoDB' })
  } else {
    res.status(503).json({ status: 'ERROR', message: 'Base de données non disponible' })
  }
})

// GET - Récupérer toutes les observations
app.get('/api/observations', async (req, res) => {
  try {
    const observations = await observationsCollection
      .find({})
      .sort({ created_at: -1 })
      .toArray()

    console.log('GET:', observations.length, 'observations récupérées')
    res.json(observations)
  } catch (error) {
    console.error('Erreur GET:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET - Récupérer une observation par ID
app.get('/api/observations/:id', async (req, res) => {
  try {
    const id = req.params.id
    let observation

    // Essayer avec ObjectId d'abord
    if (isValidObjectId(id)) {
      observation = await observationsCollection.findOne({ _id: new ObjectId(id) })
    } else {
      // Sinon chercher par id string (pour compatibilité avec anciennes données)
      observation = await observationsCollection.findOne({ id: id })
    }

    if (!observation) {
      return res.status(404).json({ error: 'Observation non trouvée' })
    }

    console.log('GET:', id, 'récupérée')
    res.json(observation)
  } catch (error) {
    console.error('Erreur GET:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST - Créer nouvelle observation
// ✅ CORRECTION: Force MongoDB à générer un vrai ObjectId
app.post('/api/observations', async (req, res) => {
  try {
    const observation = req.body

    // SUPPRIMER les champs id et _id pour forcer MongoDB à générer un ObjectId
    delete observation.id
    delete observation._id

    // Ajouter timestamps et versioning
    const now = new Date().toISOString()
    observation.created_at = observation.created_at || now
    observation.updated_at = now
    observation.version = 1

    const result = await observationsCollection.insertOne(observation)

    console.log('POST:', 'Nouvelle observation créée:', result.insertedId)

    res.status(201).json({
      success: true,
      id: result.insertedId,
      _id: result.insertedId.toString(),
      version: 1
    })
  } catch (error) {
    console.error('Erreur POST:', error)
    res.status(500).json({ error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// FONCTION DE MISE À JOUR (utilisée par PUT et PATCH)
// ═══════════════════════════════════════════════════════════════════════════════════════

async function handleUpdate(req, res) {
  try {
    const id = req.params.id
    const updates = req.body

    let existing

    // Chercher l'observation existante (ObjectId ou string)
    if (isValidObjectId(id)) {
      existing = await observationsCollection.findOne({ _id: new ObjectId(id) })
    } else {
      existing = await observationsCollection.findOne({ id: id })
    }

    if (!existing) {
      return res.status(404).json({ error: 'Observation non trouvée' })
    }

    // Incrémenter version
    const newVersion = (existing.version || 0) + 1
    const now = new Date().toISOString()

    // Nettoyer les champs système
    delete updates.id
    delete updates._id

    // Mettre à jour
    let result
    if (isValidObjectId(id)) {
      result = await observationsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updated_at: now, version: newVersion } }
      )
    } else {
      result = await observationsCollection.updateOne(
        { id: id },
        { $set: { ...updates, updated_at: now, version: newVersion } }
      )
    }

    console.log('UPDATE:', id, 'mise à jour v' + (existing.version || 0), '→ v' + newVersion)

    res.json({
      success: true,
      modified: result.modifiedCount,
      version: newVersion,
      id: existing.id,
      _id: existing._id.toString ? existing._id.toString() : existing._id
    })
  } catch (error) {
    console.error('Erreur UPDATE:', error)
    res.status(500).json({ error: error.message })
  }
}

// PUT/PATCH - Routes de mise à jour
app.put('/api/observations/:id', handleUpdate)
app.patch('/api/observations/:id', handleUpdate)

// DELETE - Supprimer une observation
// ✅ CORRECTION: Accepte TOUS les types d'IDs pour nettoyer les temp.xxx
app.delete('/api/observations/:id', async (req, res) => {
  try {
    const id = req.params.id
    console.log('DELETE demandé pour id:', id)

    let result

    // Essayer avec ObjectId d'abord (IDs valides)
    if (isValidObjectId(id)) {
      result = await observationsCollection.deleteOne({ _id: new ObjectId(id) })
    } else {
      // Accepter aussi les IDs string (temp.xxx et données corrompues)
      result = await observationsCollection.deleteOne({ id: id })
    }

    if (result.deletedCount === 0) {
      console.log('DELETE:', id, 'non trouvée')
      return res.status(404).json({ error: 'Observation non trouvée' })
    }

    console.log('DELETE:', id, 'supprimée avec succès')
    res.json({ success: true, deletedCount: result.deletedCount, id: id })
  } catch (error) {
    console.error('Erreur DELETE:', error)
    res.status(500).json({ error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// ROUTE DE MIGRATION: Migrer IDs string vers ObjectId
// ═══════════════════════════════════════════════════════════════════════════════════════

app.post('/api/migrate-ids', async (req, res) => {
  try {
    console.log('Démarrage de la migration des IDs...')

    // Trouver toutes les observations avec id de type string
    const corrupted = await observationsCollection
      .find({ id: { $type: 'string' } })
      .toArray()

    console.log(corrupted.length, 'observations avec IDs string trouvées')

    let migrated = 0
    let failed = 0
    const report = []

    for (const obs of corrupted) {
      try {
        const oldId = obs.id

        // Créer une copie sans id
        const newObs = { ...obs }
        delete newObs.id

        // Insérer avec un nouvel ObjectId
        const result = await observationsCollection.insertOne(newObs)

        // Supprimer l'ancienne version
        await observationsCollection.deleteOne({ id: oldId })

        migrated++
        report.push({ oldId: oldId, newId: result.insertedId.toString(), status: 'success' })
        console.log('Migré:', oldId, '→', result.insertedId)
      } catch (err) {
        failed++
        report.push({ oldId: obs.id, status: 'failed', error: err.message })
        console.error('Échec migration:', obs.id, err)
      }
    }

    console.log('Migration terminée:', migrated, 'succès,', failed, 'échecs')

    res.json({
      success: true,
      total: corrupted.length,
      migrated: migrated,
      failed: failed,
      report: report
    })
  } catch (error) {
    console.error('Erreur migration:', error)
    res.status(500).json({ error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// DÉMARRER LE SERVEUR
// ═══════════════════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('═'.repeat(50))
  console.log('Serveur démarré sur le port:', PORT)
  console.log('═'.repeat(50))

  console.log('Endpoints disponibles:')
  console.log('  GET /api/health')
  console.log('  GET /api/observations')
  console.log('  GET /api/observations/:id')
  console.log('  POST /api/observations')
  console.log('  PUT /api/observations/:id')
  console.log('  DELETE /api/observations/:id')
  console.log('  POST /api/migrate-ids')
  console.log('═'.repeat(50))
})

module.exports = app

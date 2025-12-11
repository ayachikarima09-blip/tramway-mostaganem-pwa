const APIBASE = 'https://tramway-pwa-backend.onrender.com'
const DBNAME = 'tramway-observations'
const STORENAME = 'observations'
const DBVERSION = 1

let db
let allObservations = []
let currentEditId = null

// ═══════════════════════════════════════════════════════════════════════════════════════
// FONCTION DE NORMALISATION
// ═══════════════════════════════════════════════════════════════════════════════════════

function normalizeObservation(obs) {
  // Synchroniser id et _id
  if (obs.id && !obs._id) obs._id = obs.id
  else if (obs._id && !obs.id) obs.id = obs._id

  // Assurer que les timestamps existent
  if (!obs.created_at) obs.created_at = new Date().toISOString()
  if (!obs.updated_at) obs.updated_at = obs.created_at

  // Initialiser version si absente
  if (!obs.version) obs.version = 1

  return obs
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// BASE DE DONNÉES
// ═══════════════════════════════════════════════════════════════════════════════════════

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DBNAME, DBVERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORENAME)) {
        db.createObjectStore(STORENAME, { keyPath: 'id' })
      }
    }
  })
}

async function saveObservation(obs) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORENAME, 'readwrite')
    const store = tx.objectStore(STORENAME)
    const request = store.put(obs)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function getAllLocal() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORENAME, 'readonly')
    const store = tx.objectStore(STORENAME)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function deleteLocal(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORENAME, 'readwrite')
    const store = tx.objectStore(STORENAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// CONNEXION
// ═══════════════════════════════════════════════════════════════════════════════════════

async function checkConnection() {
  try {
    const res = await fetch(APIBASE + '/api/health', {
      method: 'GET',
      cache: 'no-cache',
      headers: { 'Content-Type': 'application/json' }
    })

    const data = await res.json()
    const status = document.getElementById('status')

    if (res.ok) {
      status.className = 'status-bar status-online'
      status.innerHTML = '<span class="status-indicator"></span><span>Connecté MongoDB</span>'
      return true
    } else {
      status.className = 'status-bar status-offline'
      status.innerHTML = '<span class="status-indicator"></span><span>Hors ligne Mode local</span>'
      return false
    }
  } catch (err) {
    console.error('Connection error:', err)
    const status = document.getElementById('status')
    status.className = 'status-bar status-offline'
    status.innerHTML = '<span class="status-indicator"></span><span>Hors ligne Mode local</span>'
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// NOUVELLE OBSERVATION
// ═══════════════════════════════════════════════════════════════════════════════════════

function openNewObservationModal() {
  const modal = document.getElementById('new-observation-modal')
  const form = document.getElementById('observation-form')
  currentEditId = null
  form.reset()

  document.querySelector('observation-form input[name="date"]').value = new Date().toISOString().split('T')[0]

  const tbody = document.getElementById('comptage-table-new')
  tbody.innerHTML = `<tr>
    <td><input type="text" name="comptage-horaire" placeholder="HH:MM"></td>
    <td><input type="number" name="comptage-montees" min="0" value="0"></td>
    <td><input type="number" name="comptage-descentes" min="0" value="0"></td>
    <td><input type="number" name="comptage-attente" min="0" value="0"></td>
    <td><input type="text" name="comptage-observations" placeholder="Observations"></td>
  </tr>`

  modal.style.display = 'block'
}

function closeNewObservationModal() {
  document.getElementById('new-observation-modal').style.display = 'none'
}

function addComptageRowNew() {
  const tbody = document.getElementById('comptage-table-new')
  const newRow = document.createElement('tr')
  newRow.innerHTML = `<td><input type="text" name="comptage-horaire" placeholder="HH:MM"></td>
    <td><input type="number" name="comptage-montees" min="0" value="0"></td>
    <td><input type="number" name="comptage-descentes" min="0" value="0"></td>
    <td><input type="number" name="comptage-attente" min="0" value="0"></td>
    <td><input type="text" name="comptage-observations" placeholder="Observations"></td>`
  tbody.appendChild(newRow)
}

function addComptageRowEdit() {
  const tbody = document.getElementById('comptage-table-edit')
  const newRow = document.createElement('tr')
  newRow.innerHTML = `<td><input type="text" name="comptage-horaire" placeholder="HH:MM"></td>
    <td><input type="number" name="comptage-montees" min="0" value="0"></td>
    <td><input type="number" name="comptage-descentes" min="0" value="0"></td>
    <td><input type="number" name="comptage-attente" min="0" value="0"></td>
    <td><input type="text" name="comptage-observations" placeholder="Observations"></td>`
  tbody.appendChild(newRow)
}

function getCheckboxValues(name, formElement) {
  const checkboxes = formElement.querySelectorAll(`input[name="${name}"]:checked`)
  return Array.from(checkboxes).map(cb => cb.value)
}

function getComptageData(formElement) {
  const horaires = formElement.querySelectorAll('input[name="comptage-horaire"]')
  const montees = formElement.querySelectorAll('input[name="comptage-montees"]')
  const descentes = formElement.querySelectorAll('input[name="comptage-descentes"]')
  const attente = formElement.querySelectorAll('input[name="comptage-attente"]')
  const observations = formElement.querySelectorAll('input[name="comptage-observations"]')

  const comptage = []

  for (let i = 0; i < horaires.length; i++) {
    const h = horaires[i].value.trim()
    const m = parseInt(montees[i].value) || 0
    const d = parseInt(descentes[i].value) || 0
    const a = parseInt(attente[i].value) || 0
    const o = observations[i].value.trim()

    if (h || m || d || a || o) {
      // Validation du format horaire HH:MM
      if (h && !/^\d{1,2}:\d{2}$/.test(h)) {
        showMessage(`Format horaire invalide ligne ${i + 1}: "${h}". Utilisez HH:MM`, 'error')
        return null
      }

      // Validation des nombres positifs
      if (m < 0 || d < 0 || a < 0) {
        showMessage(`Les comptages doivent être des nombres positifs (ligne ${i + 1})`, 'error')
        return null
      }

      comptage.push({ horaire: h, montees: m, descentes: d, attente: a, observations: o })
    }
  }

  return comptage
}

async function handleNewObservationSubmit(event) {
  event.preventDefault()

  const formData = new FormData(event.target)

  const observation = {
    id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: formData.get('date'),
    jour: formData.get('jour'),
    heuredebut: formData.get('heuredebut'),
    heurefin: formData.get('heurefin'),
    dureetotale: formData.get('dureetotale'),
    lieustation: formData.get('lieustation'),
    quartier: formData.get('quartier'),
    meteo: getCheckboxValues('meteo', event.target),
    temperature: formData.get('temperature'),
    typeobservation: formData.get('typeobservation'),
    typeespace: getCheckboxValues('typeespace', event.target),
    intensiteinteractions: formData.get('intensiteinteractions'),
    naturepatrimoine: getCheckboxValues('naturepatrimoine', event.target),
    comptagehoraire: getComptageData(event.target),
    frequenceintervalle: formData.get('frequenceintervalle'),
    nombrerames: formData.get('nombrerames'),
    profilhommes: formData.get('profilhommes'),
    profilfemmes: formData.get('profilfemmes'),
    profilenfants: formData.get('profilenfants'),
    profiladolescents: formData.get('profiladolescents'),
    profiladultes: formData.get('profiladultes'),
    profilages: formData.get('profilages'),
    profilpmr: formData.get('profilpmr'),
    comportementtelephone: formData.get('comportementtelephone'),
    comportementtelephonedetail: formData.get('comportementtelephonedetail'),
    comportementlecture: formData.get('comportementlecture'),
    comportementlecturedetail: formData.get('comportementlecturedetail'),
    comportementconversations: formData.get('comportementconversations'),
    comportementconversationsdetail: formData.get('comportementconversationsdetail'),
    comportementattenteassise: formData.get('comportementattenteassise'),
    comportementattenteassisedetail: formData.get('comportementattenteassisedetail'),
    comportementattentedebout: formData.get('comportementattentedebout'),
    comportementattentedeboutdetail: formData.get('comportementattentedeboutdetail'),
    comportementregardfenetre: formData.get('comportementregardfenetre'),
    comportementregardfenetredetail: formData.get('comportementregardfenetredetail'),
    comportementcommerce: formData.get('comportementcommerce'),
    comportementcommercedetail: formData.get('comportementcommercedetail'),
    comportementrassemblements: formData.get('comportementrassemblements'),
    comportementrassemblementsdetail: formData.get('comportementrassemblementsdetail'),
    ambiancesonore: formData.get('ambiancesonore'),
    sonsdominants: formData.get('sonsdominants'),
    ambiancevisuelle: formData.get('ambiancevisuelle'),
    ambianceolfactive: formData.get('ambianceolfactive'),
    atmospheregenerale: formData.get('atmospheregenerale'),
    natureinteractions: formData.get('natureinteractions'),
    groupessociauxidentifies: formData.get('groupessociauxidentifies'),
    pratiquessociales: formData.get('pratiquessociales'),
    conversationsverbatim: formData.get('conversationsverbatim'),
    languesutilisees: getCheckboxValues('languesutilisees', event.target),
    thematiquesevoquees: formData.get('thematiquesevoquees'),
    elementspatrimoniaux: formData.get('elementspatrimoniaux'),
    etatconservation: formData.get('etatconservation'),
    perceptionpatrimoine: formData.get('perceptionpatrimoine'),
    impressionsgenerales: formData.get('impressionsgenerales'),
    elementssurprenants: formData.get('elementssurprenants'),
    tensionsconflits: formData.get('tensionsconflits'),
    appropriationsespace: formData.get('appropriationsespace'),
    hypothese1: formData.get('hypothese1'),
    hypothese2: formData.get('hypothese2'),
    hypothese3: formData.get('hypothese3'),
    notescomplementaires: formData.get('notescomplementaires'),
    pistesprochaine: formData.get('pistesprochaine'),
    questionsmethodologiques: formData.get('questionsmethodologiques'),
    synced: false,
    createdat: new Date().toISOString(),
    updatedat: new Date().toISOString(),
    version: 1
  }

  // Normaliser avant sauvegarde
  normalizeObservation(observation)

  try {
    const isOnline = await checkConnection()

    if (isOnline) {
      const res = await fetch(APIBASE + '/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(observation)
      })

      if (res.ok) {
        const data = await res.json()
        // Récuprer id de MongoDB
        if (data.id) observation.id = data.id
        else if (data.id) observation.id = data.id.toString()

        if (data.version) observation.version = data.version
        observation.synced = true

        showMessage('Observation enregistrée et synchronisée avec le serveur !', 'success')
        await saveObservation(observation)

        if (!observation.synced) {
          showMessage('Observation enregistrée localement. Synchronisation en attente de connexion.', 'success')
        }

        closeNewObservationModal()

        // Recharger depuis le local UNIQUEMENT
        allObservations = await getAllLocal()
        // NORMALISER après rechargement
        allObservations = allObservations.map(obs => normalizeObservation(obs))
        displayObservations(allObservations)
      } else {
        throw new Error('Erreur serveur')
      }
    } else {
      throw new Error('Pas de connexion')
    }
  } catch (error) {
    console.error('Erreur lors de la soumission:', error)

    try {
      await saveObservation(observation)
      showMessage('Erreur réseau. Observation enregistrée localement pour synchronisation ultérieure.', 'error')
      closeNewObservationModal()
      allObservations = await getAllLocal()
      // NORMALISER après rechargement
      allObservations = allObservations.map(obs => normalizeObservation(obs))
      displayObservations(allObservations)
    } catch (dbError) {
      showMessage('Erreur critique : Impossible d'enregistrer localement.', 'error')
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// AFFICHAGE DES OBSERVATIONS
// ═══════════════════════════════════════════════════════════════════════════════════════

async function loadAndDisplay() {
  console.log('Démarrage loadAndDisplay...')

  const isOnline = await checkConnection()

  // Charger d'abord depuis le local
  allObservations = await getAllLocal()
  // NORMALISER toutes les observations locales au chargement
  allObservations = allObservations.map(obs => normalizeObservation(obs))
  console.log('Observations locales chargées:', allObservations.length)

  // Afficher immédiatement les observations locales
  displayObservations(allObservations)

  // Si en ligne, synchroniser en arrière-plan SANS écraser le local
  if (isOnline) {
    try {
      console.log('Synchronisation avec MongoDB en arrière-plan...')

      const res = await fetch(APIBASE + '/api/observations', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (res.ok) {
        const response = await res.json()
        let mongoData

        if (Array.isArray(response)) mongoData = response
        else if (response.observations && Array.isArray(response.observations)) mongoData = response.observations
        else if (response.data && Array.isArray(response.data)) mongoData = response.data
        else mongoData = []

        console.log('Observations MongoDB:', mongoData.length)

        // Fusionner intelligemment
        for (const mongoObs of mongoData) {
          // Normaliser l'observation MongoDB
          normalizeObservation(mongoObs)

          const localObs = allObservations.find(o => o.id === mongoObs.id || o.id === mongoObs.id || o.id === mongoObs._id)

          if (!localObs) {
            // Pas de version locale → ajouter depuis MongoDB
            mongoObs.synced = true
            await saveObservation(mongoObs)
            console.log('Ajout depuis MongoDB:', mongoObs.id)
          } else {
            // Comparer les versions
            const mongoTime = new Date(mongoObs.updatedat || mongoObs.createdat)
            const localTime = new Date(localObs.updatedat || localObs.createdat)
            const mongoVersion = mongoObs.version || 0
            const localVersion = localObs.version || 0

            // MongoDB plus récent → mettre à jour local
            if (mongoTime > localTime || mongoVersion > localVersion) {
              mongoObs.id = localObs.id
              mongoObs.synced = true
              await saveObservation(mongoObs)
              console.log('MAJ depuis MongoDB:', mongoObs.id, `v${localVersion}→v${mongoVersion}`)
            }
          }
        }

        // ✅ FIX SYNCHRONISATION: Supprimer du local ce qui n'existe plus au serveur
        const mongoIds = new Set(mongoData.map(obs => obs.id || obs._id))

        for (const localObs of allObservations) {
          if (!mongoIds.has(localObs.id)) {
            // Observation supprimée du serveur = supprimer du local aussi
            await deleteLocal(localObs.id)
            console.log('🗑️ Supprimée zombie:', localObs.id)
          }
        }

        // Recharger et rafficher
        allObservations = await getAllLocal()
        // NORMALISER après rechargement
        allObservations = allObservations.map(obs => normalizeObservation(obs))
        displayObservations(allObservations)
      }
    } catch (err) {
      console.error('Erreur de synchronisation MongoDB:', err)
    }
  }
}

function displayObservations(observations) {
  const container = document.getElementById('observations-list')

  if (!observations || observations.length === 0) {
    container.innerHTML = `<div class="empty-state" style="font-size: 4em;">
      <div>
        <h3>Aucune observation</h3>
        <p>Créez votre première observation ou importez un fichier JSON</p>
      </div>
    </div>`
    return
  }

  observations.sort((a, b) => new Date(b.date) - new Date(a.date))

  container.innerHTML = observations.map(obs => {
    const obsId = obs.id || obs._id

    return `<div class="observation-card">
      <div class="observation-header">
        <div>
          <div class="observation-title">${obs.lieustation || 'Station non définie'}</div>
          <div style="color: #666; margin-top: 5px;">
            ${formatDate(obs.date || obs.jour)} ${obs.heuredebut} - ${obs.heurefin}
          </div>
        </div>
        <div>
          <span class="sync-badge ${obs.synced ? 'synced' : 'pending'}">
            ${obs.synced ? '✓ Sync' : '⟳ Local'}
          </span>
        </div>
      </div>
      <div class="observation-meta">
        <div class="meta-item">
          <span class="meta-label">Type</span>
          ${obs.typeobservation || 'NA'}
        </div>
        <div class="meta-item">
          <span class="meta-label">Météo</span>
          ${Array.isArray(obs.meteo) ? obs.meteo.join(', ') : obs.meteo || 'NA'}
        </div>
        <div class="meta-item">
          <span class="meta-label">Température</span>
          ${obs.temperature || 'NA'}°C
        </div>
      </div>
      ${obs.impressionsgenerales ? `<div class="observation-content">
        <strong>Impressions</strong><br>
        ${obs.impressionsgenerales.substring(0, 200)}${obs.impressionsgenerales.length > 200 ? '...' : ''}
      </div>` : ''}
      <div class="observation-actions">
        <button class="btn btn-info btn-small" onclick="viewDetails('${obsId}')">Voir détails</button>
        <button class="btn btn-warning btn-small" onclick="deleteObservation('${obsId}')">Supprimer</button>
        ${!obs.synced ? `<button class="btn btn-secondary btn-small" onclick="syncOne('${obsId}')">Sync</button>` : ''}
      </div>
    </div>`
  }).join('')
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR')
  } catch {
    return dateStr
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// DÉTAILS ET ÉDITION
// ═══════════════════════════════════════════════════════════════════════════════════════

function viewDetails(id) {
  // Comparaison améliorée pour gérer les ObjectId MongoDB et les IDs locaux
  const obs = allObservations.find(o => {
    const mongoId = typeof o.id === 'object' ? o.id.toString() : o.id
    const localId = o.id
    return localId === id || mongoId === id || localId === id.toString() || mongoId === id.toString()
  })

  if (!obs) return

  currentEditId = id
  const modal = document.getElementById('details-modal')
  const body = document.getElementById('modal-body')
  body.innerHTML = generateEditForm(obs)
  modal.style.display = 'block'
}

function generateEditForm(obs) {
  const renderComptageRows = (comptageData) => {
    if (!comptageData || comptageData.length === 0) {
      return `<tr><td><input type="text" name="comptage-horaire" placeholder="HH:MM"></td><td><input type="number" name="comptage-montees" min="0" value="0"></td><td><input type="number" name="comptage-descentes" min="0" value="0"></td><td><input type="number" name="comptage-attente" min="0" value="0"></td><td><input type="text" name="comptage-observations" placeholder="Observations"></td></tr>`
    }

    return comptageData.map(row => `<tr><td><input type="text" name="comptage-horaire" value="${row.horaire}" placeholder="HH:MM"></td><td><input type="number" name="comptage-montees" value="${row.montees || 0}" min="0"></td><td><input type="number" name="comptage-descentes" value="${row.descentes || 0}" min="0"></td><td><input type="number" name="comptage-attente" value="${row.attente || 0}" min="0"></td><td><input type="text" name="comptage-observations" value="${row.observations}" placeholder="Observations"></td></tr>`).join('')
  }

  const obsId = obs.id || obs._id

  // Helpers pour les checkboxes
  const meteoChecked = (val) => Array.isArray(obs.meteo) && obs.meteo.includes(val) ? 'checked' : ''
  const typeEspaceChecked = (val) => Array.isArray(obs.typeespace) && obs.typeespace.includes(val) ? 'checked' : ''
  const naturePatrimoineChecked = (val) => Array.isArray(obs.naturepatrimoine) && obs.naturepatrimoine.includes(val) ? 'checked' : ''
  const languesChecked = (val) => Array.isArray(obs.languesutilisees) && obs.languesutilisees.includes(val) ? 'checked' : ''

  return `<form id="edit-form" onsubmit="handleEditSubmit(event)">
    <!-- SECTION IDENTIFICATION -->
    <div class="form-section">
      <h3>IDENTIFICATION DE LA SESSION</h3>
      <div class="form-row">
        <div class="form-group"><label>Date</label><input type="date" name="date" value="${obs.date}" required></div>
        <div class="form-group"><label>Jour</label><select name="jour"><option value="">Sélectionner</option>${['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(j => `<option value="${j}" ${obs.jour === j ? 'selected' : ''}>${j}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Heure début</label><input type="time" name="heuredebut" value="${obs.heuredebut}"></div>
        <div class="form-group"><label>Heure fin</label><input type="time" name="heurefin" value="${obs.heurefin}"></div>
        <div class="form-group"><label>Durée totale (min)</label><input type="number" name="dureetotale" value="${obs.dureetotale}" min="0"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Station/Tronçon</label><input type="text" name="lieustation" value="${obs.lieustation}"></div>
        <div class="form-group"><label>Quartier</label><input type="text" name="quartier" value="${obs.quartier}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Météo</label>
          <div class="checkbox-group">
            ${['Ensoleillé', 'Nuageux', 'Pluie', 'Vent'].map(m => `<div class="checkbox-item"><input type="checkbox" name="meteo" value="${m}" ${meteoChecked(m)}><label>${m}</label></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Température (°C)</label><input type="number" name="temperature" value="${obs.temperature}" min="-10" max="60"></div>
        <div class="form-group"><label>Type d'observation</label><select name="typeobservation"><option value="">Sélectionner</option>${['Statique (poste fixe)', 'Mobile (parcours)', 'Mixte'].map(t => `<option value="${t}" ${obs.typeobservation === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      </div>
    </div>

    <!-- SECTION QUANTITATIVE -->
    <div class="form-section">
      <h3>DONNÉES QUANTITATIVES</h3>
      <h4>Flux et Fréquentation</h4>
      <div class="form-group"><label>Comptage usagers</label><table class="counting-table"><thead><tr><th>Horaire</th><th>Montées</th><th>Descentes</th><th>Attente</th><th>Observations</th></tr></thead><tbody id="comptage-table-edit">${renderComptageRows(obs.comptagehoraire)}</tbody></table><button type="button" class="add-row-btn" onclick="addComptageRowEdit()">Ajouter ligne</button></div>
      <div class="form-row">
        <div class="form-group"><label>Fréquence rames (min)</label><input type="number" name="frequenceintervalle" value="${obs.frequenceintervalle}" min="0"></div>
        <div class="form-group"><label>Nombre rames</label><input type="number" name="nombrerames" value="${obs.nombrerames}" min="0"></div>
      </div>
      <h4>Profil Usagers</h4>
      <div class="form-row">
        <div class="form-group"><label>Hommes</label><input type="number" name="profilhommes" value="${obs.profilhommes}" min="0" max="100"></div>
        <div class="form-group"><label>Femmes</label><input type="number" name="profilfemmes" value="${obs.profilfemmes}" min="0" max="100"></div>
        <div class="form-group"><label>Enfants</label><input type="number" name="profilenfants" value="${obs.profilenfants}" min="0" max="100"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Adolescents</label><input type="number" name="profiladolescents" value="${obs.profiladolescents}" min="0" max="100"></div>
        <div class="form-group"><label>Adultes</label><input type="number" name="profiladultes" value="${obs.profiladultes}" min="0" max="100"></div>
        <div class="form-group"><label>Âgés</label><input type="number" name="profilages" value="${obs.profilages}" min="0" max="100"></div>
      </div>
      <div class="form-group"><label>PMR</label><input type="number" name="profilpmr" value="${obs.profilpmr}" min="0" max="100"></div>
    </div>

    <!-- SECTION NOTES -->
    <div class="form-section">
      <h3>NOTES COMPLÉMENTAIRES</h3>
      <div class="form-group"><label>Notes supplémentaires</label><textarea name="notescomplementaires" placeholder="Informations additionnelles..." style="min-height: 150px">${obs.notescomplementaires || ''}</textarea></div>
      <div class="form-group"><label>Pistes prochaine observation</label><textarea name="pistesprochaine" placeholder="À observer la prochaine fois...">${obs.pistesprochaine || ''}</textarea></div>
      <div class="form-group"><label>Questions méthodologiques</label><textarea name="questionsmethodologiques" placeholder="Questions sur la méthode...">${obs.questionsmethodologiques || ''}</textarea></div>
    </div>

    <div style="display: flex; gap: 10px; margin-top: 20px;">
      <button type="submit" class="btn btn-primary" style="flex: 1; padding: 18px; font-size: 1.2em;">Enregistrer</button>
      <button type="button" class="btn btn-warning" onclick="exportOne('${obsId}')" style="flex: 1; padding: 18px; font-size: 1.2em;">Exporter</button>
    </div>
  </form>`
}

function closeDetailsModal() {
  document.getElementById('details-modal').style.display = 'none'
  currentEditId = null
}

async function handleEditSubmit(event) {
  event.preventDefault()
  const form = event.target
  const formData = new FormData(form)

  const obs = allObservations.find(o => o.id === currentEditId || o._id === currentEditId)

  if (!obs) {
    showMessage('Observation introuvable', 'error')
    return
  }

  // Assurer que l'ID existe pour IndexedDB
  if (!obs.id) obs.id = obs._id || currentEditId

  // Mise à jour de TOUS les champs
  obs.date = formData.get('date')
  obs.jour = formData.get('jour')
  obs.heuredebut = formData.get('heuredebut')
  obs.heurefin = formData.get('heurefin')
  obs.dureetotale = formData.get('dureetotale')
  obs.lieustation = formData.get('lieustation')
  obs.quartier = formData.get('quartier')
  obs.meteo = getCheckboxValues('meteo', form)
  obs.temperature = formData.get('temperature')
  obs.typeobservation = formData.get('typeobservation')
  obs.typeespace = getCheckboxValues('typeespace', form)
  obs.intensiteinteractions = formData.get('intensiteinteractions')
  obs.naturepatrimoine = getCheckboxValues('naturepatrimoine', form)
  obs.comptagehoraire = getComptageData(form)
  obs.frequenceintervalle = formData.get('frequenceintervalle')
  obs.nombrerames = formData.get('nombrerames')
  obs.profilhommes = formData.get('profilhommes')
  obs.profilfemmes = formData.get('profilfemmes')
  obs.profilenfants = formData.get('profilenfants')
  obs.profiladolescents = formData.get('profiladolescents')
  obs.profiladultes = formData.get('profiladultes')
  obs.profilages = formData.get('profilages')
  obs.profilpmr = formData.get('profilpmr')
  obs.notescomplementaires = formData.get('notescomplementaires')
  obs.pistesprochaine = formData.get('pistesprochaine')
  obs.questionsmethodologiques = formData.get('questionsmethodologiques')

  // Marquer comme modifié et synchroniser
  obs.synced = false
  obs.updatedat = new Date().toISOString()
  obs.version = (obs.version || 0) + 1

  normalizeObservation(obs)

  try {
    // Sauvegarder localement d'abord
    await saveObservation(obs)
    console.log('Observation sauvegardée localement:', obs.id)

    // Fermer le modal
    closeDetailsModal()

    // Recharger depuis le local UNIQUEMENT
    allObservations = await getAllLocal()
    console.log('Observations sauvegardées localement:', allObservations.length)
    displayObservations(allObservations)

    // Tenter la synchronisation en arrière-plan si connecté
    const isOnline = await checkConnection()

    if (isOnline) {
      try {
        const method = obs.id && !String(obs.id).startsWith('temp') && String(obs.id).length === 24 ? 'PUT' : 'POST'
        const url = obs.id ? APIBASE + '/api/observations/' + obs.id : APIBASE + '/api/observations'

        const res = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(obs)
        })

        if (res.ok) {
          const data = await res.json()

          if (data.id) obs.id = data.id
          else if (data.id) obs.id = data.id.toString()

          if (data.version) obs.version = data.version

          obs.synced = true
          await saveObservation(obs)

          allObservations = await getAllLocal()
          // NORMALISER après rechargement
          allObservations = allObservations.map(o => normalizeObservation(o))
          displayObservations(allObservations)

          showMessage('Observation mise à jour et synchronisée', 'success')
        } else {
          showMessage('Observation enregistrée localement. Synchronisation en attente.', 'info')
        }
      } catch (syncErr) {
        console.error('Erreur de synchronisation:', syncErr)
        showMessage('Observation enregistrée localement. Synchronisation en attente.', 'info')
      }
    } else {
      showMessage('Observation enregistrée localement. Synchronisation en attente de connexion.', 'info')
    }
  } catch (err) {
    showMessage('Erreur lors de la sauvegarde', 'error')
    console.error('Erreur de sauvegarde:', err)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// SYNCHRONISATION
// ═══════════════════════════════════════════════════════════════════════════════════════

async function syncOne(id) {
  const obs = allObservations.find(o => o.id === id || o._id === id)
  if (!obs) return

  const isOnline = await checkConnection()
  if (!isOnline) {
    showMessage('Pas de connexion', 'error')
    return
  }

  try {
    normalizeObservation(obs)

    const method = obs.id && !String(obs.id).startsWith('temp') && String(obs.id).length === 24 ? 'PUT' : 'POST'
    const url = obs.id ? APIBASE + '/api/observations/' + obs.id : APIBASE + '/api/observations'

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obs)
    })

    if (res.ok) {
      const data = await res.json()

      if (data.id) obs.id = data.id
      else if (data.id) obs.id = data.id.toString()

      if (data.version) obs.version = data.version

      obs.synced = true
      await saveObservation(obs)

      showMessage('Observation synchronisée', 'success')

      allObservations = await getAllLocal()
      // NORMALISER après rechargement
      allObservations = allObservations.map(o => normalizeObservation(o))
      displayObservations(allObservations)
    } else {
      throw new Error('Sync failed')
    }
  } catch (err) {
    showMessage('Erreur de synchronisation', 'error')
  }
}

async function syncAll() {
  const btn = document.getElementById('sync-btn')
  btn.disabled = true
  btn.textContent = 'Synchronisation...'

  const isOnline = await checkConnection()
  if (!isOnline) {
    showMessage('Pas de connexion Internet', 'error')
    btn.disabled = false
    btn.textContent = 'Synchroniser'
    return
  }

  const pending = allObservations.filter(o => !o.synced)

  if (pending.length === 0) {
    showMessage('Tout est déjà synchronisé', 'info')
    btn.disabled = false
    btn.textContent = 'Synchroniser'
    return
  }

  let success = 0

  for (const obs of pending) {
    try {
      normalizeObservation(obs)

      const method = obs.id && !String(obs.id).startsWith('temp') && String(obs.id).length === 24 ? 'PUT' : 'POST'
      const url = obs.id ? APIBASE + '/api/observations/' + obs.id : APIBASE + '/api/observations'

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obs)
      })

      if (res.ok) {
        const data = await res.json()

        if (data.id) obs.id = data.id
        else if (data.id) obs.id = data.id.toString()

        if (data.version) obs.version = data.version

        obs.synced = true
        await saveObservation(obs)
        success++
      }
    } catch (err) {
      console.error('Sync error:', err)
    }
  }

  showMessage(success + '/' + pending.length + ' observations synchronisées', 'success')
  btn.disabled = false
  btn.textContent = 'Synchroniser'

  allObservations = await getAllLocal()
  // NORMALISER après rechargement
  allObservations = allObservations.map(o => normalizeObservation(o))
  displayObservations(allObservations)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// SUPPRESSION
// ═══════════════════════════════════════════════════════════════════════════════════════

async function deleteObservation(id) {
  if (!confirm('Supprimer cette observation ?')) return

  try {
    // 1. Vérifier la connexion
    const isOnline = await checkConnection()

    // 2. Si connecté, supprimer d'abord dans MongoDB
    if (isOnline) {
      try {
        const res = await fetch(APIBASE + '/api/observations/' + id, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        })

        if (res.ok) {
          console.log('Supprimé de MongoDB:', id)
        } else {
          console.error('Échec suppression MongoDB')
        }
      } catch (err) {
        console.error('Erreur suppression MongoDB:', err)
      }
    }

    // 3. Supprimer du local IndexedDB
    await deleteLocal(id)

    // 4. Recharger et afficher
    showMessage('Observation supprimée', 'success')

    allObservations = await getAllLocal()
    // NORMALISER après rechargement
    allObservations = allObservations.map(o => normalizeObservation(o))
    displayObservations(allObservations)
  } catch (err) {
    showMessage('Erreur de suppression', 'error')
    console.error(err)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// EXPORT FIXÉ - VERSION CORRIGÉE ET TESTÉE (11 décembre 2025)
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Exporte TOUTES les observations en fichier JSON
 * FIXES:
 * - Élément 'a' attaché au DOM (document.body.appendChild)
 * - Attendre un peu avant click() pour s'assurer que le navigateur est prêt
 * - Logs détaillés pour déboguer
 * - Gestion d'erreurs complète
 * - Révocation URL après quelques ms (s'assurer que le téléchargement a commencé)
 */
async function exportAll() {
  console.log('🚀 exportAll() lancé')

  // Étape 1: Vérifier qu'il y a des données
  console.log(`📊 Nombre d'observations: ${allObservations.length}`)

  if (allObservations.length === 0) {
    console.warn('⚠️  Aucune observation à exporter')
    showMessage('Aucune observation à exporter', 'info')
    return
  }

  try {
    // Étape 2: Sérialiser en JSON
    console.log('📝 Conversion en JSON...')
    const json = JSON.stringify(allObservations, null, 2)
    console.log(`✓ JSON créé: ${json.length} caractères, ${(json.length / 1024).toFixed(2)} KB`)

    // Étape 3: Créer blob
    console.log('📦 Création du blob...')
    const blob = new Blob([json], { type: 'application/json' })
    console.log(`✓ Blob créé: ${blob.size} bytes`)

    // Étape 4: Créer URL d'objet
    console.log('🔗 Création de l\'URL...')
    const url = URL.createObjectURL(blob)
    console.log(`✓ URL créée: ${url.substring(0, 50)}...`)

    // Étape 5: Créer élément de lien
    console.log('⚙️  Préparation du lien de téléchargement...')
    const a = document.createElement('a')
    a.href = url

    // Générer nom de fichier avec date et nombre d'observations
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]
    const filename = `tramway-observations-${dateStr}-${allObservations.length}obs.json`
    a.download = filename
    a.style.display = 'none'  // Caché du DOM

    console.log(`✓ Fichier: ${filename}`)

    // CRITICAL: Attacher à DOM (obligatoire pour a.click())
    console.log('📌 Attacher à DOM...')
    document.body.appendChild(a)
    console.log('✓ Attaché au DOM')

    // Étape 6: Déclencher le téléchargement
    console.log('⬇️  Déclenchement du téléchargement...')
    a.click()
    console.log('✓ click() exécuté')

    // Étape 7: Nettoyer (après un délai pour s'assurer que le DL a commencé)
    console.log('🧹 Nettoyage...')
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      console.log('✓ Ressources libérées')
    }, 100)

    // Succès
    console.log('✅ Export réussi!')
    showMessage(`✅ Export réussi (${allObservations.length} observations)`, 'success')

  } catch (error) {
    console.error('❌ ERREUR lors de l\'export:', error)
    showMessage(`Erreur export: ${error.message}`, 'error')
  }
}

/**
 * Exporte UNE SEULE observation en fichier JSON
 * Même corrections que exportAll()
 */
async function exportOne(id) {
  console.log(`🚀 exportOne(${id}) lancé`)

  // Trouver l'observation (gestion ObjectId et string)
  const obs = allObservations.find(o => {
    const mongoId = typeof o.id === 'object' ? o.id.toString() : o.id
    const localId = o.id
    return (
      localId === id ||
      mongoId === id ||
      localId === id.toString() ||
      mongoId === id.toString()
    )
  })

  if (!obs) {
    console.warn(`⚠️  Observation ${id} non trouvée`)
    showMessage('Observation non trouvée', 'error')
    return
  }

  console.log('📊 Observation trouvée:', obs.lieustation)

  try {
    // Étape 1: Sérialiser
    console.log('📝 Conversion en JSON...')
    const json = JSON.stringify(obs, null, 2)
    console.log(`✓ JSON créé: ${json.length} caractères`)

    // Étape 2: Blob
    console.log('📦 Création du blob...')
    const blob = new Blob([json], { type: 'application/json' })
    console.log(`✓ Blob: ${blob.size} bytes`)

    // Étape 3: URL
    console.log('🔗 Création de l\'URL...')
    const url = URL.createObjectURL(blob)
    console.log(`✓ URL créée`)

    // Étape 4: Élément de lien
    console.log('⚙️  Préparation du lien...')
    const a = document.createElement('a')
    a.href = url

    const lieu = obs.lieustation || 'sans-nom'
    const date = obs.date || new Date().toISOString().split('T')[0]
    const filename = `observation-${lieu.replace(/\s+/g, '-')}-${date}.json`
    a.download = filename
    a.style.display = 'none'

    console.log(`✓ Fichier: ${filename}`)

    // CRITICAL: Attacher à DOM
    console.log('📌 Attacher à DOM...')
    document.body.appendChild(a)
    console.log('✓ Attaché')

    // Étape 5: Déclencher
    console.log('⬇️  Téléchargement...')
    a.click()
    console.log('✓ click() exécuté')

    // Étape 6: Nettoyer
    console.log('🧹 Nettoyage...')
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      console.log('✓ Ressources libérées')
    }, 100)

    // Succès
    console.log('✅ Export réussi!')
    showMessage(`✅ Observation exportée: ${filename}`, 'success')

  } catch (error) {
    console.error('❌ ERREUR export:', error)
    showMessage(`Erreur export: ${error.message}`, 'error')
  }
}

/**
 * Test d'export avec diagnostic complet
 * À exécuter dans F12 → Console
 */
async function testExportDebug() {
  console.log('\n🧪 TEST EXPORT DEBUG')
  console.log('═'.repeat(80))

  // Test 1: Données locales disponibles?
  console.log('\n1️⃣  VÉRIFIER DONNÉES LOCALES')
  const local = await getAllLocal()
  console.log(`   Observations locales: ${local.length}`)

  if (local.length === 0) {
    console.error('   ❌ PROBLÈME: IndexedDB est VIDE!')
    console.error('   → Créez des observations ou importez un fichier')
    return
  }
  console.log('   ✅ OK')

  // Test 2: JSON sérialisable?
  console.log('\n2️⃣  TESTER SÉRIALISATION JSON')
  try {
    const json = JSON.stringify(local)
    console.log(`   ✅ JSON OK: ${(json.length / 1024).toFixed(2)} KB`)
  } catch (err) {
    console.error('   ❌ ERREUR JSON:', err.message)
    return
  }

  // Test 3: Blob créable?
  console.log('\n3️⃣  TESTER CRÉATION BLOB')
  try {
    const json = JSON.stringify(local)
    const blob = new Blob([json], { type: 'application/json' })
    console.log(`   ✅ Blob OK: ${blob.size} bytes`)
  } catch (err) {
    console.error('   ❌ ERREUR Blob:', err.message)
    return
  }

  // Test 4: URL createObjectURL fonctionne?
  console.log('\n4️⃣  TESTER createObjectURL')
  let testUrl
  try {
    const json = JSON.stringify(local)
    const blob = new Blob([json], { type: 'application/json' })
    testUrl = URL.createObjectURL(blob)
    console.log(`   ✅ URL OK: ${testUrl.substring(0, 50)}...`)
  } catch (err) {
    console.error('   ❌ ERREUR URL:', err.message)
    return
  }

  // Test 5: Élément 'a' accessible?
  console.log('\n5️⃣  TESTER ÉLÉMENT LIEN')
  try {
    const a = document.createElement('a')
    a.href = testUrl
    a.download = 'test.json'
    console.log(`   ✅ Élément OK, propriétés:`)
    console.log(`      - href: ${a.href.substring(0, 50)}...`)
    console.log(`      - download: ${a.download}`)
  } catch (err) {
    console.error('   ❌ ERREUR:', err.message)
    return
  }

  // Test 6: Autorisation clic?
  console.log('\n6️⃣  TESTER CLIC')
  try {
    const json = JSON.stringify(local)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    document.body.appendChild(a)  // IMPORTANT!
    a.href = url
    a.download = `test-export-${new Date().toISOString().split('T')[0]}.json`

    console.log(`   📝 À cliquer: ${a.download}`)
    a.click()
    console.log(`   ✅ click() exécuté`)

    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)

  } catch (err) {
    console.error('   ❌ ERREUR:', err.message)
    return
  }

  // Résultat final
  console.log('\n' + '═'.repeat(80))
  console.log('✅ TOUS LES TESTS RÉUSSIS')
  console.log('L\'export devrait fonctionner!')
  console.log('═'.repeat(80) + '\n')
}

/**
 * Simulation d'export sans déclencher le téléchargement
 * Utile pour tester sans spammer des fichiers
 */
async function testExportSim() {
  console.log('🧪 SIMULATION EXPORT (sans télécharger)')

  const local = await getAllLocal()
  console.log(`Observations: ${local.length}`)

  if (local.length === 0) {
    console.error('❌ Aucune donnée à exporter')
    return
  }

  try {
    const json = JSON.stringify(local, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    console.log('✅ Export simulé réussi:')
    console.log(`   - Observations: ${local.length}`)
    console.log(`   - Taille JSON: ${(json.length / 1024).toFixed(2)} KB`)
    console.log(`   - Taille blob: ${blob.size} bytes`)
    console.log(`   - URL: ${url.substring(0, 60)}...`)

    // NE PAS télécharger, juste montrer que ça marche
    URL.revokeObjectURL(url)

  } catch (err) {
    console.error('❌ Erreur:', err)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// SYNCHRONISATION FIXÉE - Suppression inverse des observations zombies
// ═══════════════════════════════════════════════════════════════════════════════════════

async function testSyncDebug() {
  console.log('\n🧪 TEST SYNCHRONISATION DEBUG')
  console.log('═'.repeat(80))

  // Récupérer local
  const local = await getAllLocal()
  console.log(`\n1️⃣  LOCAL: ${local.length} observations`)

  // Récupérer serveur
  try {
    const res = await fetch(APIBASE + '/api/observations')
    const mongoData = await res.json()
    const mongo = Array.isArray(mongoData) ? mongoData : mongoData.observations || mongoData.data || []

    console.log(`2️⃣  SERVEUR: ${mongo.length} observations`)

    // Chercher zombies
    const serverIds = new Set(mongo.map(o => String(o._id || o.id)))
    const zombies = local.filter(o => !serverIds.has(String(o.id)))

    if (zombies.length === 0) {
      console.log('\n✅ ZÉRO zombies = SYNC OK!')
    } else {
      console.log(`\n❌ TROUVÉ ${zombies.length} ZOMBIES:`)
      zombies.forEach(z => console.log(`   - ${z.id}: ${z.lieustation}`))
    }
  } catch (err) {
    console.error('❌ Erreur récupération serveur:', err)
  }

  console.log('\n' + '═'.repeat(80) + '\n')
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// IMPORT/EXPORT
// ═══════════════════════════════════════════════════════════════════════════════════════

function importFile() {
  document.getElementById('file-input').click()
}

async function handleImport(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()

  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result)
      const observations = Array.isArray(data) ? data : [data]

      let imported = 0
      for (const obs of observations) {
        if (!obs.id) obs.id = Date.now() + Math.random()
        obs.synced = false
        normalizeObservation(obs)
        await saveObservation(obs)
        imported++
      }

      showMessage(imported + ' observations importées', 'success')

      allObservations = await getAllLocal()
      // NORMALISER après rechargement
      allObservations = allObservations.map(obs => normalizeObservation(obs))
      displayObservations(allObservations)
    } catch (err) {
      showMessage('Fichier JSON invalide', 'error')
      console.error(err)
    }
  }

  reader.readAsText(file)
  event.target.value = ''
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// RECHERCHE/FILTRAGE
// ═══════════════════════════════════════════════════════════════════════════════════════

function filterObservations() {
  const search = document.getElementById('search').value.toLowerCase()

  const filtered = allObservations.filter(obs =>
    obs.lieustation?.toLowerCase().includes(search) ||
    obs.date?.includes(search) ||
    obs.impressionsgenerales?.toLowerCase().includes(search) ||
    obs.jour?.toLowerCase().includes(search)
  )

  displayObservations(filtered)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════════════

function showMessage(text, type) {
  const msg = document.getElementById('message')
  msg.className = `message ${type}`
  msg.textContent = text
  msg.style.display = 'block'

  setTimeout(() => {
    msg.style.display = 'none'
  }, 5000)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// INITIALISATION
// ═══════════════════════════════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initialisation de l\'application...')
    await initDB()
    console.log('Base de données initialisée')

    await checkConnection()
    await loadAndDisplay()

    // Vérifier connexion toutes les 30 secondes
    setInterval(checkConnection, 30000)

    console.log('Application PWA prête')
  } catch (error) {
    console.error('Erreur d\'initialisation:', error)
    showMessage('Erreur d\'initialisation de l\'application', 'error')
  }
})

const API_BASE = 'https://tramway-pwa-backend.onrender.com';
const DB_NAME = 'tramway-observations';
const STORE_NAME = 'observations';
const DB_VERSION = 1;

let db;
let allObservations = [];
let currentEditId = null;

// ==================== FONCTION DE NORMALISATION ====================
function normalizeObservation(obs) {
    // Synchroniser id et _id
    if (obs._id && !obs.id) {
        obs.id = typeof obs._id === 'object' ? obs._id.toString() : obs._id;
    } else if (obs.id && !obs._id) {
        obs._id = obs.id;
    }
    
    // S'assurer que les timestamps existent
    if (!obs.created_at) {
        obs.created_at = new Date().toISOString();
    }
    if (!obs.updated_at) {
        obs.updated_at = obs.created_at;
    }
    
    // Initialiser version si absente
    if (!obs.version) {
        obs.version = 1;
    }
    
    return obs;
}

// ==================== CORRECTION 1: FONCTION DE COMPARAISON D'ID ROBUSTE ====================
function isMongoId(id) {
    if (!id) return false;
    const str = id.toString();
    return /^[0-9a-fA-F]{24}$/.test(str);
}

function findObservationById(id) {
    return allObservations.find(o => {
        const oId = (o.id || '').toString();
        const oMongoId = (o._id || '').toString();
        const searchId = (id || '').toString();
        return oId === searchId || oMongoId === searchId;
    });
}

// ==================== BASE DE DONNÉES ====================
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

async function saveObservation(obs) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(obs);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getAllLocal() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteLocal(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ==================== CONNEXION ====================
async function checkConnection() {
    try {
        const res = await fetch(API_BASE + '/api/health', {
            method: 'GET',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        const status = document.getElementById('status');
        
        if (res.ok && data.status === 'OK') {
            status.className = 'status-bar status-online';
            status.innerHTML = '✅ Connecté à MongoDB';
            return true;
        }
    } catch (err) {
        console.error('Connection error:', err);
    }
    
    const status = document.getElementById('status');
    status.className = 'status-bar status-offline';
    status.innerHTML = '📴 Hors ligne (Mode local)';
    return false;
}

// ==================== NOUVELLE OBSERVATION ====================
function openNewObservationModal() {
    const modal = document.getElementById('new-observation-modal');
    const form = document.getElementById('observation-form');
    currentEditId = null;
    form.reset();
    document.querySelector('#observation-form input[name="date"]').value = new Date().toISOString().split('T')[0];
    
    const tbody = document.getElementById('comptage-table-new');
    tbody.innerHTML = '';
    addComptageRowNew();
    
    modal.style.display = 'block';
}

function closeNewObservationModal() {
    document.getElementById('new-observation-modal').style.display = 'none';
}

function addComptageRowNew() {
    const tbody = document.getElementById('comptage-table-new');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="time" class="comptage-horaire" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>
        <td><input type="number" class="comptage-montees" min="0" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>
        <td><input type="number" class="comptage-descentes" min="0" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>
        <td><input type="number" class="comptage-attente" min="0" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>
        <td><input type="text" class="comptage-observations" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>
        <td><button type="button" class="remove-row-btn" onclick="this.parentElement.parentElement.remove()">✕</button></td>
    `;
    tbody.appendChild(row);
}

function getCheckboxValues(name, form = null) {
    const frm = form || document.getElementById('observation-form');
    const checkboxes = frm.querySelectorAll(`input[name="${name}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
}

function getComptageData(form = null) {
    const frm = form || document.getElementById('observation-form');
    const rows = frm.querySelectorAll('#comptage-table-new tr');
    const data = [];
    
    rows.forEach(row => {
        const horaire = row.querySelector('.comptage-horaire')?.value || '';
        const montees = row.querySelector('.comptage-montees')?.value || '';
        const descentes = row.querySelector('.comptage-descentes')?.value || '';
        const attente = row.querySelector('.comptage-attente')?.value || '';
        const observations = row.querySelector('.comptage-observations')?.value || '';
        
        if (horaire || montees || descentes || attente || observations) {
            data.push({ horaire, montees, descentes, attente, observations });
        }
    });
    
    return data.length > 0 ? data : null;
}

async function handleNewObservation(event) {
    event.preventDefault();
    
    const form = document.getElementById('observation-form');
    const formData = new FormData(form);
    const newObs = {};
    
    // Récupérer tous les champs du formulaire
    newObs.date = formData.get('date');
    newObs.jour = formData.get('jour');
    newObs.heure_debut = formData.get('heure_debut');
    newObs.heure_fin = formData.get('heure_fin');
    newObs.duree_totale = formData.get('duree_totale');
    newObs.lieu_station = formData.get('lieu_station');
    newObs.quartier = formData.get('quartier');
    newObs.meteo = getCheckboxValues('meteo');
    newObs.temperature = formData.get('temperature');
    newObs.type_observation = formData.get('type_observation');
    newObs.type_espace = getCheckboxValues('type_espace');
    newObs.intensite_interactions = formData.get('intensite_interactions');
    newObs.nature_patrimoine = getCheckboxValues('nature_patrimoine');
    newObs.comptage_horaire = getComptageData();
    newObs.frequence_intervalle = formData.get('frequence_intervalle');
    newObs.nombre_rames = formData.get('nombre_rames');
    
    // Profil usagers
    newObs.profil_hommes = formData.get('profil_hommes');
    newObs.profil_femmes = formData.get('profil_femmes');
    newObs.profil_enfants = formData.get('profil_enfants');
    newObs.profil_adolescents = formData.get('profil_adolescents');
    newObs.profil_adultes = formData.get('profil_adultes');
    newObs.profil_ages = formData.get('profil_ages');
    newObs.profil_pmr = formData.get('profil_pmr');
    
    // Comportements
    newObs.comportement_telephone = formData.get('comportement_telephone');
    newObs.comportement_telephone_detail = formData.get('comportement_telephone_detail');
    newObs.comportement_lecture = formData.get('comportement_lecture');
    newObs.comportement_lecture_detail = formData.get('comportement_lecture_detail');
    newObs.comportement_conversations = formData.get('comportement_conversations');
    newObs.comportement_conversations_detail = formData.get('comportement_conversations_detail');
    newObs.comportement_attente_assise = formData.get('comportement_attente_assise');
    newObs.comportement_attente_assise_detail = formData.get('comportement_attente_assise_detail');
    newObs.comportement_attente_debout = formData.get('comportement_attente_debout');
    newObs.comportement_attente_debout_detail = formData.get('comportement_attente_debout_detail');
    newObs.comportement_regard_fenetre = formData.get('comportement_regard_fenetre');
    newObs.comportement_regard_fenetre_detail = formData.get('comportement_regard_fenetre_detail');
    newObs.comportement_commerce = formData.get('comportement_commerce');
    newObs.comportement_commerce_detail = formData.get('comportement_commerce_detail');
    newObs.comportement_rassemblements = formData.get('comportement_rassemblements');
    newObs.comportement_rassemblements_detail = formData.get('comportement_rassemblements_detail');
    
    // Ambiances
    newObs.ambiance_sonore = formData.get('ambiance_sonore');
    newObs.sons_dominants = formData.get('sons_dominants');
    newObs.ambiance_visuelle = formData.get('ambiance_visuelle');
    newObs.ambiance_olfactive = formData.get('ambiance_olfactive');
    newObs.atmosphere_generale = formData.get('atmosphere_generale');
    
    // Interactions sociales
    newObs.nature_interactions = formData.get('nature_interactions');
    newObs.groupes_sociaux_identifies = formData.get('groupes_sociaux_identifies');
    newObs.pratiques_sociales = formData.get('pratiques_sociales');
    
    // Perceptions
    newObs.conversations_verbatim = formData.get('conversations_verbatim');
    newObs.langues_utilisees = getCheckboxValues('langues_utilisees');
    newObs.thematiques_evoquees = formData.get('thematiques_evoquees');
    
    // Patrimoine
    newObs.elements_patrimoniaux = formData.get('elements_patrimoniaux');
    newObs.etat_conservation = formData.get('etat_conservation');
    newObs.perception_patrimoine = formData.get('perception_patrimoine');
    
    // Réflexions post-observation
    newObs.impressions_generales = formData.get('impressions_generales');
    newObs.elements_surprenants = formData.get('elements_surprenants');
    newObs.tensions_conflits = formData.get('tensions_conflits');
    newObs.appropriations_espace = formData.get('appropriations_espace');
    newObs.hypothese_1 = formData.get('hypothese_1');
    newObs.hypothese_2 = formData.get('hypothese_2');
    newObs.hypothese_3 = formData.get('hypothese_3');
    
    // Notes complémentaires
    newObs.notes_complementaires = formData.get('notes_complementaires');
    newObs.pistes_prochaine = formData.get('pistes_prochaine');
    newObs.questions_methodologiques = formData.get('questions_methodologiques');
    
    // Générer un ID unique (UUID v4)
    newObs.id = 'obs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    newObs.synced = false;
    
    normalizeObservation(newObs);
    
    try {
        await saveObservation(newObs);
        allObservations.push(newObs);
        displayObservations(allObservations);
        closeNewObservationModal();
        showMessage('✅ Observation enregistrée', 'success');
        backgroundSync();
    } catch (err) {
        console.error('Erreur:', err);
        showMessage('❌ Erreur d\'enregistrement', 'error');
    }
}

// ==================== AFFICHAGE ====================
function displayObservations(observations) {
    const container = document.getElementById('observations-container');
    
    if (observations.length === 0) {
        container.innerHTML = '<div class="empty-message">📭 Aucune observation pour le moment</div>';
        updateObservationCount();
        return;
    }
    
    container.innerHTML = observations.map(obs => `
        <div class="observation-card" data-id="${obs.id || obs._id}">
            <div class="card-header">
                <div class="card-title">${obs.lieu_station || obs.quartier || 'Sans titre'}</div>
                <div class="card-sync">${obs.synced ? '✅' : '⏳'}</div>
            </div>
            <div class="card-meta">
                <span>📅 ${obs.date || 'N/A'}</span>
                <span>🕐 ${obs.heure_debut || 'N/A'}</span>
            </div>
            <div class="card-actions">
                <button class="btn-small btn-primary" onclick="showDetails('${obs.id || obs._id}')">👁️ Détails</button>
                <button class="btn-small btn-secondary" onclick="editObservation('${obs.id || obs._id}')">✏️ Éditer</button>
                <button class="btn-small btn-danger" onclick="deleteObservation('${obs.id || obs._id}')">🗑️ Supprimer</button>
                <button class="btn-small btn-warning" onclick="syncOne('${obs.id || obs._id}')">🔄 Sync</button>
            </div>
        </div>
    `).join('');
    
    updateObservationCount();
}

function showDetails(id) {
    const obs = findObservationById(id);
    if (!obs) {
        showMessage('❌ Observation introuvable', 'error');
        return;
    }
    
    const modal = document.getElementById('details-modal');
    const content = document.getElementById('details-content');
    
    content.innerHTML = `
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; line-height: 1.8;">
            <h3 style="color: #2c5aa0; margin-bottom: 20px;">📍 Contexte</h3>
            <p><strong>Date:</strong> ${obs.date || 'N/A'}</p>
            <p><strong>Jour:</strong> ${obs.jour || 'N/A'}</p>
            <p><strong>Heure:</strong> ${obs.heure_debut || 'N/A'} - ${obs.heure_fin || 'N/A'}</p>
            <p><strong>Durée:</strong> ${obs.duree_totale || 'N/A'} min</p>
            <p><strong>Station/Tronçon:</strong> ${obs.lieu_station || 'N/A'}</p>
            <p><strong>Quartier:</strong> ${obs.quartier || 'N/A'}</p>
            <p><strong>Météo:</strong> ${(obs.meteo || []).join(', ') || 'N/A'}</p>
            <p><strong>Température:</strong> ${obs.temperature || 'N/A'}°C</p>
            <p><strong>Type d'observation:</strong> ${obs.type_observation || 'N/A'}</p>
            
            <h3 style="color: #2c5aa0; margin-top: 30px; margin-bottom: 20px;">📊 Données Quantitatives</h3>
            <p><strong>Fréquence rames:</strong> ${obs.frequence_intervalle || 'N/A'} min</p>
            <p><strong>Nombre rames:</strong> ${obs.nombre_rames || 'N/A'}</p>
            <p><strong>Profil - Hommes:</strong> ${obs.profil_hommes || 'N/A'}%</p>
            <p><strong>Profil - Femmes:</strong> ${obs.profil_femmes || 'N/A'}%</p>
            <p><strong>Profil - Enfants:</strong> ${obs.profil_enfants || 'N/A'}%</p>
            
            <h3 style="color: #2c5aa0; margin-top: 30px; margin-bottom: 20px;">🎨 Qualitatives</h3>
            <p><strong>Ambiance sonore:</strong> ${obs.ambiance_sonore || 'N/A'}</p>
            <p><strong>Sons dominants:</strong> ${obs.sons_dominants || 'N/A'}</p>
            <p><strong>Atmosphère générale:</strong> ${obs.atmosphere_generale || 'N/A'}</p>
            <p><strong>Ambiance visuelle:</strong> ${obs.ambiance_visuelle || 'N/A'}</p>
            <p><strong>Ambiance olfactive:</strong> ${obs.ambiance_olfactive || 'N/A'}</p>
            
            <h3 style="color: #2c5aa0; margin-top: 30px; margin-bottom: 20px;">💭 Réflexions</h3>
            <p><strong>Impressions générales:</strong> ${obs.impressions_generales || 'N/A'}</p>
            <p><strong>Éléments surprenants:</strong> ${obs.elements_surprenants || 'N/A'}</p>
            <p><strong>Tensions/conflits:</strong> ${obs.tensions_conflits || 'N/A'}</p>
            <p><strong>Appropriations espace:</strong> ${obs.appropriations_espace || 'N/A'}</p>
            
            <h3 style="color: #2c5aa0; margin-top: 30px; margin-bottom: 20px;">🏛️ Patrimoine</h3>
            <p><strong>Éléments patrimoniaux:</strong> ${obs.elements_patrimoniaux || 'N/A'}</p>
            <p><strong>État conservation:</strong> ${obs.etat_conservation || 'N/A'}</p>
            <p><strong>Perception patrimoine:</strong> ${obs.perception_patrimoine || 'N/A'}</p>
            
            <p style="margin-top: 30px; color: #666; font-size: 12px;"><strong>Synchronisée:</strong> ${obs.synced ? '✅ Oui' : '❌ Non'}</p>
        </div>
    `;
    
    modal.style.display = 'block';
}

function closeDetailsModal() {
    document.getElementById('details-modal').style.display = 'none';
}

// ==================== ÉDITION ====================
function editObservation(id) {
    const obs = findObservationById(id);
    if (!obs) {
        showMessage('❌ Observation introuvable', 'error');
        return;
    }
    
    currentEditId = id;
    const form = document.getElementById('observation-form');
    
    // Remplir le formulaire avec les données existantes
    form.querySelector('[name="date"]').value = obs.date || '';
    form.querySelector('[name="jour"]').value = obs.jour || '';
    form.querySelector('[name="heure_debut"]').value = obs.heure_debut || '';
    form.querySelector('[name="heure_fin"]').value = obs.heure_fin || '';
    form.querySelector('[name="duree_totale"]').value = obs.duree_totale || '';
    form.querySelector('[name="lieu_station"]').value = obs.lieu_station || '';
    form.querySelector('[name="quartier"]').value = obs.quartier || '';
    form.querySelector('[name="temperature"]').value = obs.temperature || '';
    form.querySelector('[name="type_observation"]').value = obs.type_observation || '';
    form.querySelector('[name="intensite_interactions"]').value = obs.intensite_interactions || '';
    
    // Checkboxes
    form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    if (obs.meteo && Array.isArray(obs.meteo)) {
        obs.meteo.forEach(val => {
            const cb = form.querySelector(`input[name="meteo"][value="${val}"]`);
            if (cb) cb.checked = true;
        });
    }
    
    if (obs.type_espace && Array.isArray(obs.type_espace)) {
        obs.type_espace.forEach(val => {
            const cb = form.querySelector(`input[name="type_espace"][value="${val}"]`);
            if (cb) cb.checked = true;
        });
    }
    
    if (obs.nature_patrimoine && Array.isArray(obs.nature_patrimoine)) {
        obs.nature_patrimoine.forEach(val => {
            const cb = form.querySelector(`input[name="nature_patrimoine"][value="${val}"]`);
            if (cb) cb.checked = true;
        });
    }
    
    if (obs.langues_utilisees && Array.isArray(obs.langues_utilisees)) {
        obs.langues_utilisees.forEach(val => {
            const cb = form.querySelector(`input[name="langues_utilisees"][value="${val}"]`);
            if (cb) cb.checked = true;
        });
    }
    
    // Profil
    form.querySelector('[name="profil_hommes"]').value = obs.profil_hommes || '';
    form.querySelector('[name="profil_femmes"]').value = obs.profil_femmes || '';
    form.querySelector('[name="profil_enfants"]').value = obs.profil_enfants || '';
    form.querySelector('[name="profil_adolescents"]').value = obs.profil_adolescents || '';
    form.querySelector('[name="profil_adultes"]').value = obs.profil_adultes || '';
    form.querySelector('[name="profil_ages"]').value = obs.profil_ages || '';
    form.querySelector('[name="profil_pmr"]').value = obs.profil_pmr || '';
    
    // Comportements
    form.querySelector('[name="comportement_telephone"]').checked = !!obs.comportement_telephone;
    form.querySelector('[name="comportement_telephone_detail"]').value = obs.comportement_telephone_detail || '';
    form.querySelector('[name="comportement_lecture"]').checked = !!obs.comportement_lecture;
    form.querySelector('[name="comportement_lecture_detail"]').value = obs.comportement_lecture_detail || '';
    form.querySelector('[name="comportement_conversations"]').checked = !!obs.comportement_conversations;
    form.querySelector('[name="comportement_conversations_detail"]').value = obs.comportement_conversations_detail || '';
    form.querySelector('[name="comportement_attente_assise"]').checked = !!obs.comportement_attente_assise;
    form.querySelector('[name="comportement_attente_assise_detail"]').value = obs.comportement_attente_assise_detail || '';
    form.querySelector('[name="comportement_attente_debout"]').checked = !!obs.comportement_attente_debout;
    form.querySelector('[name="comportement_attente_debout_detail"]').value = obs.comportement_attente_debout_detail || '';
    form.querySelector('[name="comportement_regard_fenetre"]').checked = !!obs.comportement_regard_fenetre;
    form.querySelector('[name="comportement_regard_fenetre_detail"]').value = obs.comportement_regard_fenetre_detail || '';
    form.querySelector('[name="comportement_commerce"]').checked = !!obs.comportement_commerce;
    form.querySelector('[name="comportement_commerce_detail"]').value = obs.comportement_commerce_detail || '';
    form.querySelector('[name="comportement_rassemblements"]').checked = !!obs.comportement_rassemblements;
    form.querySelector('[name="comportement_rassemblements_detail"]').value = obs.comportement_rassemblements_detail || '';
    
    // Ambiances
    form.querySelector('[name="ambiance_sonore"]').value = obs.ambiance_sonore || '';
    form.querySelector('[name="sons_dominants"]').value = obs.sons_dominants || '';
    form.querySelector('[name="ambiance_visuelle"]').value = obs.ambiance_visuelle || '';
    form.querySelector('[name="ambiance_olfactive"]').value = obs.ambiance_olfactive || '';
    form.querySelector('[name="atmosphere_generale"]').value = obs.atmosphere_generale || '';
    
    // Interactions
    form.querySelector('[name="nature_interactions"]').value = obs.nature_interactions || '';
    form.querySelector('[name="groupes_sociaux_identifies"]').value = obs.groupes_sociaux_identifies || '';
    form.querySelector('[name="pratiques_sociales"]').value = obs.pratiques_sociales || '';
    
    // Perceptions
    form.querySelector('[name="conversations_verbatim"]').value = obs.conversations_verbatim || '';
    form.querySelector('[name="thematiques_evoquees"]').value = obs.thematiques_evoquees || '';
    
    // Patrimoine
    form.querySelector('[name="elements_patrimoniaux"]').value = obs.elements_patrimoniaux || '';
    form.querySelector('[name="etat_conservation"]').value = obs.etat_conservation || '';
    form.querySelector('[name="perception_patrimoine"]').value = obs.perception_patrimoine || '';
    
    // Réflexions
    form.querySelector('[name="impressions_generales"]').value = obs.impressions_generales || '';
    form.querySelector('[name="elements_surprenants"]').value = obs.elements_surprenants || '';
    form.querySelector('[name="tensions_conflits"]').value = obs.tensions_conflits || '';
    form.querySelector('[name="appropriations_espace"]').value = obs.appropriations_espace || '';
    form.querySelector('[name="hypothese_1"]').value = obs.hypothese_1 || '';
    form.querySelector('[name="hypothese_2"]').value = obs.hypothese_2 || '';
    form.querySelector('[name="hypothese_3"]').value = obs.hypothese_3 || '';
    
    // Notes
    form.querySelector('[name="notes_complementaires"]').value = obs.notes_complementaires || '';
    form.querySelector('[name="pistes_prochaine"]').value = obs.pistes_prochaine || '';
    form.querySelector('[name="questions_methodologiques"]').value = obs.questions_methodologiques || '';
    
    // Frequence et rames
    form.querySelector('[name="frequence_intervalle"]').value = obs.frequence_intervalle || '';
    form.querySelector('[name="nombre_rames"]').value = obs.nombre_rames || '';
    
    // Remplir le tableau de comptage
    const tbody = document.getElementById('comptage-table-new');
    tbody.innerHTML = '';
    
    if (obs.comptage_horaire && Array.isArray(obs.comptage_horaire)) {
        obs.comptage_horaire.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="time" class="comptage-horaire" value="${item.horaire || ''}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>
                <td><input type="number" class="comptage-montees" value="${item.montees || ''}" min="0" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>
                <td><input type="number" class="comptage-descentes" value="${item.descentes || ''}" min="0" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>
                <td><input type="number" class="comptage-attente" value="${item.attente || ''}" min="0" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>
                <td><input type="text" class="comptage-observations" value="${item.observations || ''}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>
                <td><button type="button" class="remove-row-btn" onclick="this.parentElement.parentElement.remove()">✕</button></td>
            `;
            tbody.appendChild(row);
        });
    } else {
        addComptageRowNew();
    }
    
    // Bouton spécial pour édition
    form.onsubmit = async (e) => {
        e.preventDefault();
        await handleEditSubmit(e);
    };
    
    const modal = document.getElementById('new-observation-modal');
    modal.querySelector('.modal-header h2').textContent = '✏️ Éditer l\'Observation';
    const btn = modal.querySelector('button[type="submit"]');
    btn.textContent = '💾 Mettre à jour';
    
    modal.style.display = 'block';
}

async function handleEditSubmit(event) {
    event.preventDefault();
    
    const form = document.getElementById('observation-form');
    const formData = new FormData(form);
    const obs = findObservationById(currentEditId);
    
    if (!obs) {
        showMessage('❌ Observation introuvable', 'error');
        return;
    }
    
    // Assurer que l'ID est défini
    if (!obs.id) {
        obs.id = obs._id || currentEditId;
    }
    
    // Mettre à jour tous les champs
    obs.date = formData.get('date');
    obs.jour = formData.get('jour');
    obs.heure_debut = formData.get('heure_debut');
    obs.heure_fin = formData.get('heure_fin');
    obs.duree_totale = formData.get('duree_totale');
    obs.lieu_station = formData.get('lieu_station');
    obs.quartier = formData.get('quartier');
    obs.meteo = getCheckboxValues('meteo', form);
    obs.temperature = formData.get('temperature');
    obs.type_observation = formData.get('type_observation');
    obs.type_espace = getCheckboxValues('type_espace', form);
    obs.intensite_interactions = formData.get('intensite_interactions');
    obs.nature_patrimoine = getCheckboxValues('nature_patrimoine', form);
    obs.comptage_horaire = getComptageData(form);
    obs.frequence_intervalle = formData.get('frequence_intervalle');
    obs.nombre_rames = formData.get('nombre_rames');
    
    obs.profil_hommes = formData.get('profil_hommes');
    obs.profil_femmes = formData.get('profil_femmes');
    obs.profil_enfants = formData.get('profil_enfants');
    obs.profil_adolescents = formData.get('profil_adolescents');
    obs.profil_adultes = formData.get('profil_adultes');
    obs.profil_ages = formData.get('profil_ages');
    obs.profil_pmr = formData.get('profil_pmr');
    
    obs.comportement_telephone = formData.get('comportement_telephone');
    obs.comportement_telephone_detail = formData.get('comportement_telephone_detail');
    obs.comportement_lecture = formData.get('comportement_lecture');
    obs.comportement_lecture_detail = formData.get('comportement_lecture_detail');
    obs.comportement_conversations = formData.get('comportement_conversations');
    obs.comportement_conversations_detail = formData.get('comportement_conversations_detail');
    obs.comportement_attente_assise = formData.get('comportement_attente_assise');
    obs.comportement_attente_assise_detail = formData.get('comportement_attente_assise_detail');
    obs.comportement_attente_debout = formData.get('comportement_attente_debout');
    obs.comportement_attente_debout_detail = formData.get('comportement_attente_debout_detail');
    obs.comportement_regard_fenetre = formData.get('comportement_regard_fenetre');
    obs.comportement_regard_fenetre_detail = formData.get('comportement_regard_fenetre_detail');
    obs.comportement_commerce = formData.get('comportement_commerce');
    obs.comportement_commerce_detail = formData.get('comportement_commerce_detail');
    obs.comportement_rassemblements = formData.get('comportement_rassemblements');
    obs.comportement_rassemblements_detail = formData.get('comportement_rassemblements_detail');
    
    obs.ambiance_sonore = formData.get('ambiance_sonore');
    obs.sons_dominants = formData.get('sons_dominants');
    obs.ambiance_visuelle = formData.get('ambiance_visuelle');
    obs.ambiance_olfactive = formData.get('ambiance_olfactive');
    obs.atmosphere_generale = formData.get('atmosphere_generale');
    
    obs.nature_interactions = formData.get('nature_interactions');
    obs.groupes_sociaux_identifies = formData.get('groupes_sociaux_identifies');
    obs.pratiques_sociales = formData.get('pratiques_sociales');
    
    obs.conversations_verbatim = formData.get('conversations_verbatim');
    obs.langues_utilisees = getCheckboxValues('langues_utilisees', form);
    obs.thematiques_evoquees = formData.get('thematiques_evoquees');
    
    obs.elements_patrimoniaux = formData.get('elements_patrimoniaux');
    obs.etat_conservation = formData.get('etat_conservation');
    obs.perception_patrimoine = formData.get('perception_patrimoine');
    
    obs.impressions_generales = formData.get('impressions_generales');
    obs.elements_surprenants = formData.get('elements_surprenants');
    obs.tensions_conflits = formData.get('tensions_conflits');
    obs.appropriations_espace = formData.get('appropriations_espace');
    obs.hypothese_1 = formData.get('hypothese_1');
    obs.hypothese_2 = formData.get('hypothese_2');
    obs.hypothese_3 = formData.get('hypothese_3');
    
    obs.notes_complementaires = formData.get('notes_complementaires');
    obs.pistes_prochaine = formData.get('pistes_prochaine');
    obs.questions_methodologiques = formData.get('questions_methodologiques');
    
    obs.updated_at = new Date().toISOString();
    obs.synced = false;
    
    try {
        await saveObservation(obs);
        displayObservations(allObservations);
        closeNewObservationModal();
        showMessage('✅ Observation mise à jour', 'success');
        
        // Réinitialiser le formulaire
        form.onsubmit = handleNewObservation;
        document.querySelector('#new-observation-modal .modal-header h2').textContent = '📋 Nouvelle Observation';
        document.querySelector('#new-observation-modal button[type="submit"]').textContent = '💾 Enregistrer l\'Observation';
        
        backgroundSync();
    } catch (err) {
        console.error('Erreur:', err);
        showMessage('❌ Erreur de mise à jour', 'error');
    }
}

// ==================== SUPPRESSION ====================
async function deleteObservation(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette observation ?')) {
        return;
    }
    
    try {
        await deleteLocal(id);
        allObservations = allObservations.filter(o => {
            const oId = (o.id || '').toString();
            const oMongoId = (o._id || '').toString();
            const searchId = (id || '').toString();
            return oId !== searchId && oMongoId !== searchId;
        });
        displayObservations(allObservations);
        showMessage('✅ Observation supprimée', 'success');
    } catch (err) {
        console.error('Erreur:', err);
        showMessage('❌ Erreur de suppression', 'error');
    }
}

// ==================== SYNCHRONISATION ====================
async function syncOne(id) {
    const obs = findObservationById(id);
    if (!obs) {
        showMessage('❌ Observation introuvable', 'error');
        return;
    }
    
    try {
        const res = await fetch(API_BASE + '/api/observations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(obs)
        });
        
        if (res.ok) {
            const data = await res.json();
            obs.synced = true;
            await saveObservation(obs);
            displayObservations(allObservations);
            showMessage('✅ Synchronisée', 'success');
        } else {
            showMessage('❌ Erreur de synchronisation', 'error');
        }
    } catch (err) {
        console.error('Sync error:', err);
        showMessage('📴 Mode hors ligne', 'error');
    }
}

async function backgroundSync() {
    const unsyncedObs = allObservations.filter(o => !o.synced);
    
    for (const obs of unsyncedObs) {
        try {
            const res = await fetch(API_BASE + '/api/observations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(obs)
            });
            
            if (res.ok) {
                obs.synced = true;
                await saveObservation(obs);
            }
        } catch (err) {
            console.error('Background sync error:', err);
        }
    }
    
    if (unsyncedObs.length > 0) {
        displayObservations(allObservations);
    }
}

// ==================== EXPORT / IMPORT ====================
function exportAll() {
    if (allObservations.length === 0) {
        showMessage('❌ Aucune observation à exporter', 'error');
        return;
    }
    
    const json = JSON.stringify(allObservations, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `observations_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showMessage(`✅ ${allObservations.length} observation(s) exportée(s)`, 'success');
}

function importObservations() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                let data = JSON.parse(event.target.result);
                
                if (!Array.isArray(data)) {
                    data = [data];
                }
                
                let imported = 0;
                for (const obs of data) {
                    normalizeObservation(obs);
                    await saveObservation(obs);
                    imported++;
                }
                
                allObservations = await getAllLocal();
                allObservations = allObservations.map(o => normalizeObservation(o));
                displayObservations(allObservations);
                showMessage(`✅ ${imported} observation(s) importée(s)`, 'success');
            } catch (err) {
                showMessage('❌ Erreur d\'import', 'error');
                console.error(err);
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// ==================== UTILITAIRES ====================
function showMessage(message, type = 'info') {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message message-${type}`;
    messageDiv.style.display = 'block';
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 3000);
}

// ==================== FONCTIONS DE RECHERCHE ET COMPTAGE ====================
function updateObservationCount() {
    const container = document.getElementById('observations-container');
    const cards = container.querySelectorAll('.observation-card:not([style*="display: none"])');
    document.getElementById('observation-count').textContent = cards.length;
}

function searchObservations() {
    const searchInput = document.getElementById('search-input').value.toLowerCase();
    const cards = document.querySelectorAll('.observation-card');
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (text.includes(searchInput)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
    
    updateObservationCount();
}

// Mettre à jour le compteur au chargement et à chaque modification
window.addEventListener('load', updateObservationCount);
const observer = new MutationObserver(updateObservationCount);
const container = document.getElementById('observations-container');
observer.observe(container, { childList: true });

// ==================== CHARGEMENT ET AFFICHAGE ====================
async function loadAndDisplay() {
    try {
        allObservations = await getAllLocal();
        allObservations = allObservations.map(obs => normalizeObservation(obs));
        displayObservations(allObservations);
        
        // Lancer la synchronisation en arrière-plan
        backgroundSync();
    } catch (error) {
        console.error('Erreur de chargement:', error);
        showMessage('❌ Erreur de chargement', 'error');
    }
}

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', async function () {
    try {
        console.log('🚀 Initialisation de l\'application...');
        await initDB();
        console.log('✅ Base de données initialisée');
        
        await checkConnection();
        await loadAndDisplay();
        
        setInterval(checkConnection, 30000);
        setInterval(backgroundSync, 60000); // Sync toutes les minutes
        
        console.log('✅ Application PWA prête');
    } catch (error) {
        console.error('❌ Erreur d\'initialisation:', error);
        showMessage('❌ Erreur d\'initialisation de l\'application', 'error');
    }
});

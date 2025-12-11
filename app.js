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
        <td><input type="time" class="time-input"></td>
        <td><input type="number" class="number-input" min="0"></td>
        <td><input type="number" class="number-input" min="0"></td>
        <td><input type="number" class="number-input" min="0"></td>
        <td><input type="text" class="text-input" placeholder="obs..."></td>
        <td><button type="button" class="remove-row-btn" onclick="this.parentRow.remove()">❌</button></td>
    `;
    tbody.appendChild(row);
}

function addComptageRowEdit() {
    const tbody = document.getElementById('comptage-table-edit');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="time" class="time-input"></td>
        <td><input type="number" class="number-input" min="0"></td>
        <td><input type="number" class="number-input" min="0"></td>
        <td><input type="number" class="number-input" min="0"></td>
        <td><input type="text" class="text-input" placeholder="obs..."></td>
        <td><button type="button" class="remove-row-btn" onclick="this.parentRow.remove()">❌</button></td>
    `;
    tbody.appendChild(row);
}

function getComptageData(form) {
    const tbody = form.querySelector('table.counting-table tbody');
    if (!tbody) return [];
    const rows = [];
    tbody.querySelectorAll('tr').forEach(tr => {
        const inputs = tr.querySelectorAll('input');
        if (inputs[0].value) {
            rows.push({
                horaire: inputs[0].value,
                montees: parseInt(inputs[1].value) || 0,
                descentes: parseInt(inputs[2].value) || 0,
                attente: parseInt(inputs[3].value) || 0,
                observations: inputs[4].value || ''
            });
        }
    });
    return rows;
}

function renderComptageRows(comptage) {
    if (!comptage || comptage.length === 0) return '';
    return comptage.map((row, idx) => `
        <tr>
            <td><input type="time" class="time-input" value="${row.horaire || ''}"></td>
            <td><input type="number" class="number-input" min="0" value="${row.montees || 0}"></td>
            <td><input type="number" class="number-input" min="0" value="${row.descentes || 0}"></td>
            <td><input type="number" class="number-input" min="0" value="${row.attente || 0}"></td>
            <td><input type="text" class="text-input" value="${row.observations || ''}" placeholder="obs..."></td>
            <td><button type="button" class="remove-row-btn" onclick="this.parentRow.remove()">❌</button></td>
        </tr>
    `).join('');
}

function getCheckboxValues(name, form) {
    const checkboxes = form.querySelectorAll(`input[name="${name}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
}

function meteoChecked(value, obs) {
    if (!obs || !obs.meteo) return '';
    return obs.meteo.includes(value) ? 'checked' : '';
}

function typeEspaceChecked(value, obs) {
    if (!obs || !obs.type_espace) return '';
    return obs.type_espace.includes(value) ? 'checked' : '';
}

function naturePatrimoineChecked(value, obs) {
    if (!obs || !obs.nature_patrimoine) return '';
    return obs.nature_patrimoine.includes(value) ? 'checked' : '';
}

function languesChecked(value, obs) {
    if (!obs || !obs.langues_utilisees) return '';
    return obs.langues_utilisees.includes(value) ? 'checked' : '';
}

// ==================== AFFICHAGE ====================
function displayObservations(observations) {
    const container = document.getElementById('observations-container');
    if (!observations || observations.length === 0) {
        container.innerHTML = '<p class="empty-message">📌 Créez votre première observation ou importez un fichier JSON</p>';
        return;
    }

    container.innerHTML = observations.map(obs => {
        const date = obs.date ? new Date(obs.date).toLocaleDateString('fr-FR') : 'N/A';
        const lieu = obs.lieu_station || 'N/A';
        const syncBadge = obs.synced ? '☁️' : '💾';
        const obsId = obs.id || obs._id;
        return `
            <div class="observation-card" onclick="viewDetails('${obsId}')">
                <div class="card-header">
                    <span class="card-title">${lieu}</span>
                    <span class="card-sync">${syncBadge}</span>
                </div>
                <div class="card-meta">
                    <span>📅 ${date}</span>
                    <span>🕐 ${obs.heure_debut || 'N/A'}</span>
                </div>
                <div class="card-actions">
                    <button class="btn-small" onclick="event.stopPropagation(); editObservation('${obsId}')">✏️ Éditer</button>
                    <button class="btn-small" onclick="event.stopPropagation(); deleteObservation('${obsId}')">🗑️ Supprimer</button>
                    <button class="btn-small" onclick="event.stopPropagation(); exportOne('${obsId}')">📥 Exporter</button>
                </div>
            </div>
        `;
    }).join('');
}

function viewDetails(id) {
    const obs = findObservationById(id);
    if (!obs) {
        showMessage('❌ Observation introuvable', 'error');
        return;
    }

    const modal = document.getElementById('details-modal');
    const content = document.getElementById('details-content');
    content.innerHTML = `
        <h2>${obs.lieu_station || 'N/A'}</h2>
        <p><strong>Date:</strong> ${obs.date || 'N/A'}</p>
        <p><strong>Heure:</strong> ${obs.heure_debut || 'N/A'} - ${obs.heure_fin || 'N/A'}</p>
        <p><strong>Météo:</strong> ${(obs.meteo || []).join(', ') || 'N/A'}</p>
        <p><strong>Température:</strong> ${obs.temperature || 'N/A'}°C</p>
        <p><strong>Quartier:</strong> ${obs.quartier || 'N/A'}</p>
        <p><strong>Ambiance sonore:</strong> ${obs.ambiance_sonore || 'N/A'}</p>
        <p><strong>Atmosphère:</strong> ${obs.atmosphere_generale || 'N/A'}</p>
        <p><strong>État du patrimoine:</strong> ${obs.etat_conservation || 'N/A'}</p>
        <p><strong>Impression générale:</strong> ${obs.impressions_generales || 'N/A'}</p>
        <p><strong>Synchronisée:</strong> ${obs.synced ? '✅ Oui' : '❌ Non'}</p>
        <button class="btn btn-primary" onclick="editObservation('${id}')">✏️ Éditer</button>
        <button class="btn btn-secondary" onclick="closeDetailsModal()">Fermer</button>
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
    const modal = document.getElementById('details-modal');
    const content = document.getElementById('details-content');

    const meteoCheckedFn = (value) => {
        if (!obs.meteo) return '';
        return obs.meteo.includes(value) ? 'checked' : '';
    };

    const typeEspaceCheckedFn = (value) => {
        if (!obs.type_espace) return '';
        return obs.type_espace.includes(value) ? 'checked' : '';
    };

    const naturePatrimoineCheckedFn = (value) => {
        if (!obs.nature_patrimoine) return '';
        return obs.nature_patrimoine.includes(value) ? 'checked' : '';
    };

    const languesCheckedFn = (value) => {
        if (!obs.langues_utilisees) return '';
        return obs.langues_utilisees.includes(value) ? 'checked' : '';
    };

    content.innerHTML = `
        <form id="edit-form" onsubmit="handleEditSubmit(event)">
            <div class="form-section">
                <h3>📍 CONTEXTE D'OBSERVATION</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" name="date" value="${obs.date || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Jour</label>
                        <select name="jour">
                            <option value="">Sélectionner</option>
                            ${['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(j => `<option value="${j}" ${obs.jour === j ? 'selected' : ''}>${j}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Heure début</label>
                        <input type="time" name="heure_debut" value="${obs.heure_debut || ''}">
                    </div>
                    <div class="form-group">
                        <label>Heure fin</label>
                        <input type="time" name="heure_fin" value="${obs.heure_fin || ''}">
                    </div>
                    <div class="form-group">
                        <label>Durée totale (min)</label>
                        <input type="number" name="duree_totale" value="${obs.duree_totale || ''}" min="0">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Station/Tronçon</label>
                        <input type="text" name="lieu_station" value="${obs.lieu_station || ''}">
                    </div>
                    <div class="form-group">
                        <label>Quartier</label>
                        <input type="text" name="quartier" value="${obs.quartier || ''}">
                    </div>
                </div>

                <div class="form-group">
                    <label>Météo</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" name="meteo" value="Ensoleillé" ${meteoCheckedFn('Ensoleillé')}>
                            <label>Ensoleillé</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" name="meteo" value="Nuageux" ${meteoCheckedFn('Nuageux')}>
                            <label>Nuageux</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" name="meteo" value="Pluie" ${meteoCheckedFn('Pluie')}>
                            <label>Pluie</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" name="meteo" value="Vent" ${meteoCheckedFn('Vent')}>
                            <label>Vent</label>
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Température (°C)</label>
                        <input type="number" name="temperature" value="${obs.temperature || ''}" min="-10" max="60">
                    </div>
                    <div class="form-group">
                        <label>Type d'observation</label>
                        <select name="type_observation">
                            <option value="">Sélectionner</option>
                            ${['Statique (poste fixe)', 'Mobile (parcours)', 'Mixte'].map(t => `<option value="${t}" ${obs.type_observation === t ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label>Type d'espace (TE)</label>
                    <div class="checkbox-group">
                        ${['TE-S: Station de tramway', 'TE-B: À bord du tramway', 'TE-A: Abords immédiats (<50m)', 'TE-P: Espace public connexe', 'TE-C: Corridor/axe du tramway'].map(te => `
                            <div class="checkbox-item">
                                <input type="checkbox" name="type_espace" value="${te}" ${typeEspaceCheckedFn(te)}>
                                <label>${te.split(': ')[1]}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="form-group">
                    <label>Intensité interactions</label>
                    <select name="intensite_interactions">
                        <option value="">Sélectionner</option>
                        ${['II-1: Faible (interactions isolées)', 'II-2: Modérée (interactions régulières)', 'II-3: Forte (espace très animé)', 'II-4: Très forte (événement/concentration)'].map(ii => `<option value="${ii}" ${obs.intensite_interactions === ii ? 'selected' : ''}>${ii}</option>`).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Nature patrimoine (NP)</label>
                    <div class="checkbox-group">
                        ${['NP-A: Architecture coloniale', 'NP-B: Bâti traditionnel', 'NP-C: Architecture moderne/contemporaine', 'NP-P: Patrimoine paysager', 'NP-I: Patrimoine immatériel', 'NP-M: Patrimoine mémoriel'].map(np => `
                            <div class="checkbox-item">
                                <input type="checkbox" name="nature_patrimoine" value="${np}" ${naturePatrimoineCheckedFn(np)}>
                                <label>${np.split(': ')[1]}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="form-section">
                <h3>📊 DONNÉES QUANTITATIVES</h3>
                <h4>Flux et Fréquentation</h4>
                <div class="form-group">
                    <label>Comptage usagers</label>
                    <table class="counting-table">
                        <thead>
                            <tr>
                                <th>Horaire</th>
                                <th>Montées</th>
                                <th>Descentes</th>
                                <th>Attente</th>
                                <th>Observations</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="comptage-table-edit">
                            ${renderComptageRows(obs.comptage_horaire || [])}
                        </tbody>
                    </table>
                    <button type="button" class="add-row-btn" onclick="addComptageRowEdit()">➕ Ajouter ligne</button>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Fréquence rames (min)</label>
                        <input type="number" name="frequence_intervalle" value="${obs.frequence_intervalle || ''}" min="0">
                    </div>
                    <div class="form-group">
                        <label>Nombre rames</label>
                        <input type="number" name="nombre_rames" value="${obs.nombre_rames || ''}" min="0">
                    </div>
                </div>

                <h4>Profil Usagers (%)</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Hommes</label>
                        <input type="number" name="profil_hommes" value="${obs.profil_hommes || ''}" min="0" max="100">
                    </div>
                    <div class="form-group">
                        <label>Femmes</label>
                        <input type="number" name="profil_femmes" value="${obs.profil_femmes || ''}" min="0" max="100">
                    </div>
                    <div class="form-group">
                        <label>Enfants</label>
                        <input type="number" name="profil_enfants" value="${obs.profil_enfants || ''}" min="0" max="100">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Adolescents</label>
                        <input type="number" name="profil_adolescents" value="${obs.profil_adolescents || ''}" min="0" max="100">
                    </div>
                    <div class="form-group">
                        <label>Adultes</label>
                        <input type="number" name="profil_adultes" value="${obs.profil_adultes || ''}" min="0" max="100">
                    </div>
                    <div class="form-group">
                        <label>Âgés</label>
                        <input type="number" name="profil_ages" value="${obs.profil_ages || ''}" min="0" max="100">
                    </div>
                </div>

                <div class="form-group">
                    <label>PMR (%)</label>
                    <input type="number" name="profil_pmr" value="${obs.profil_pmr || ''}" min="0" max="100">
                </div>

                <h4>Comportements</h4>
                <div class="checkbox-with-detail">
                    <input type="checkbox" name="comportement_telephone" value="oui" ${obs.comportement_telephone ? 'checked' : ''}>
                    <label>Téléphone</label>
                    <input type="text" name="comportement_telephone_detail" value="${obs.comportement_telephone_detail || ''}" placeholder="détails">
                </div>
                <div class="checkbox-with-detail">
                    <input type="checkbox" name="comportement_lecture" value="oui" ${obs.comportement_lecture ? 'checked' : ''}>
                    <label>Lecture</label>
                    <input type="text" name="comportement_lecture_detail" value="${obs.comportement_lecture_detail || ''}" placeholder="détails">
                </div>
                <div class="checkbox-with-detail">
                    <input type="checkbox" name="comportement_conversations" value="oui" ${obs.comportement_conversations ? 'checked' : ''}>
                    <label>Conversations</label>
                    <input type="text" name="comportement_conversations_detail" value="${obs.comportement_conversations_detail || ''}" placeholder="détails">
                </div>
                <div class="checkbox-with-detail">
                    <input type="checkbox" name="comportement_attente_assise" value="oui" ${obs.comportement_attente_assise ? 'checked' : ''}>
                    <label>Attente assise</label>
                    <input type="text" name="comportement_attente_assise_detail" value="${obs.comportement_attente_assise_detail || ''}" placeholder="détails">
                </div>
                <div class="checkbox-with-detail">
                    <input type="checkbox" name="comportement_attente_debout" value="oui" ${obs.comportement_attente_debout ? 'checked' : ''}>
                    <label>Attente debout</label>
                    <input type="text" name="comportement_attente_debout_detail" value="${obs.comportement_attente_debout_detail || ''}" placeholder="détails">
                </div>
                <div class="checkbox-with-detail">
                    <input type="checkbox" name="comportement_regard_fenetre" value="oui" ${obs.comportement_regard_fenetre ? 'checked' : ''}>
                    <label>Regard fenêtre</label>
                    <input type="text" name="comportement_regard_fenetre_detail" value="${obs.comportement_regard_fenetre_detail || ''}" placeholder="détails">
                </div>
                <div class="checkbox-with-detail">
                    <input type="checkbox" name="comportement_commerce" value="oui" ${obs.comportement_commerce ? 'checked' : ''}>
                    <label>Commerce informel</label>
                    <input type="text" name="comportement_commerce_detail" value="${obs.comportement_commerce_detail || ''}" placeholder="détails">
                </div>
                <div class="checkbox-with-detail">
                    <input type="checkbox" name="comportement_rassemblements" value="oui" ${obs.comportement_rassemblements ? 'checked' : ''}>
                    <label>Rassemblements</label>
                    <input type="text" name="comportement_rassemblements_detail" value="${obs.comportement_rassemblements_detail || ''}" placeholder="détails">
                </div>
            </div>

            <div class="form-section">
                <h3>🎨 DONNÉES QUALITATIVES</h3>
                <h4>Ambiances</h4>
                <div class="form-group">
                    <label>Ambiance sonore</label>
                    <select name="ambiance_sonore">
                        <option value="">Sélectionner</option>
                        ${['Silencieux', 'Calme', 'Animé', 'Bruyant', 'Très bruyant'].map(a => `<option value="${a}" ${obs.ambiance_sonore === a ? 'selected' : ''}>${a}</option>`).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Sons dominants</label>
                    <textarea name="sons_dominants" placeholder="Décrire...">${obs.sons_dominants || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Ambiance visuelle</label>
                    <textarea name="ambiance_visuelle" placeholder="Éléments marquants...">${obs.ambiance_visuelle || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Ambiance olfactive</label>
                    <textarea name="ambiance_olfactive" placeholder="Odeurs...">${obs.ambiance_olfactive || ''}</textarea>
                </div>

                <div class="form-group">
                    <label>Atmosphère générale</label>
                    <select name="atmosphere_generale">
                        <option value="">Sélectionner</option>
                        ${['Apaisée', 'Tendue', 'Conviviale', 'Anonyme', 'Festive'].map(a => `<option value="${a}" ${obs.atmosphere_generale === a ? 'selected' : ''}>${a}</option>`).join('')}
                    </select>
                </div>

                <h4>Interactions Sociales</h4>
                <div class="form-group">
                    <label>Nature interactions</label>
                    <textarea name="nature_interactions" placeholder="Décrire...">${obs.nature_interactions || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Groupes sociaux</label>
                    <textarea name="groupes_sociaux_identifies" placeholder="Décrire...">${obs.groupes_sociaux_identifies || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Pratiques sociales</label>
                    <textarea name="pratiques_sociales" placeholder="Décrire...">${obs.pratiques_sociales || ''}</textarea>
                </div>

                <h4>Perceptions</h4>
                <div class="form-group">
                    <label>Conversations (verbatim)</label>
                    <textarea name="conversations_verbatim" placeholder='"..." "..."'>${obs.conversations_verbatim || ''}</textarea>
                </div>

                <div class="form-group">
                    <label>Langues utilisées</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" name="langues_utilisees" value="Arabe dialectal" ${languesCheckedFn('Arabe dialectal')}>
                            <label>Arabe</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" name="langues_utilisees" value="Français" ${languesCheckedFn('Français')}>
                            <label>Français</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" name="langues_utilisees" value="Tamazight" ${languesCheckedFn('Tamazight')}>
                            <label>Tamazight</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" name="langues_utilisees" value="Mixte" ${languesCheckedFn('Mixte')}>
                            <label>Mixte</label>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Thématiques évoquées</label>
                    <textarea name="thematiques_evoquees" placeholder="Sujets...">${obs.thematiques_evoquees || ''}</textarea>
                </div>

                <h4>Patrimoine</h4>
                <div class="form-group">
                    <label>Éléments patrimoniaux</label>
                    <textarea name="elements_patrimoniaux" placeholder="Décrire...">${obs.elements_patrimoniaux || ''}</textarea>
                </div>

                <div class="form-group">
                    <label>État conservation</label>
                    <select name="etat_conservation">
                        <option value="">Sélectionner</option>
                        ${['Excellent', 'Bon', 'Moyen', 'Dégradé', 'Ruine'].map(e => `<option value="${e}" ${obs.etat_conservation === e ? 'selected' : ''}>${e}</option>`).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Perception patrimoine</label>
                    <select name="perception_patrimoine">
                        <option value="">Sélectionner</option>
                        ${['Valorisé', 'Ignoré', 'Détourné', 'Approprié', 'Rejeté'].map(p => `<option value="${p}" ${obs.perception_patrimoine === p ? 'selected' : ''}>${p}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="form-section">
                <h3>💭 RÉFLEXIONS POST-OBSERVATION</h3>
                <h4>Analyse à Chaud</h4>
                <div class="form-group">
                    <label>Impressions générales</label>
                    <textarea name="impressions_generales" placeholder="Vos impressions...">${obs.impressions_generales || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Éléments surprenants</label>
                    <textarea name="elements_surprenants" placeholder="Ce qui vous a surpris...">${obs.elements_surprenants || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Tensions/conflits</label>
                    <textarea name="tensions_conflits" placeholder="Conflits notés...">${obs.tensions_conflits || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Appropriations espace</label>
                    <textarea name="appropriations_espace" placeholder="Comment l'espace est utilisé...">${obs.appropriations_espace || ''}</textarea>
                </div>

                <h4>Hypothèses Émergentes</h4>
                <div class="form-group">
                    <label>Hypothèse 1</label>
                    <textarea name="hypothese_1" placeholder="Première hypothèse...">${obs.hypothese_1 || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Hypothèse 2</label>
                    <textarea name="hypothese_2" placeholder="Deuxième hypothèse...">${obs.hypothese_2 || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Hypothèse 3</label>
                    <textarea name="hypothese_3" placeholder="Troisième hypothèse...">${obs.hypothese_3 || ''}</textarea>
                </div>
            </div>

            <div class="form-section">
                <h3>📝 NOTES COMPLÉMENTAIRES</h3>
                <div class="form-group">
                    <label>Notes supplémentaires</label>
                    <textarea name="notes_complementaires" placeholder="Informations additionnelles..." style="min-height: 150px;">${obs.notes_complementaires || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Pistes prochaine observation</label>
                    <textarea name="pistes_prochaine" placeholder="À observer la prochaine fois...">${obs.pistes_prochaine || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Questions méthodologiques</label>
                    <textarea name="questions_methodologiques" placeholder="Questions sur la méthode...">${obs.questions_methodologiques || ''}</textarea>
                </div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button type="submit" class="btn btn-primary" style="flex: 1; padding: 18px; font-size: 1.2em;">💾 Enregistrer</button>
                <button type="button" class="btn btn-warning" onclick="exportOne('${id}')" style="flex: 1; padding: 18px; font-size: 1.2em;">📥 Exporter</button>
                <button type="button" class="btn btn-secondary" onclick="closeDetailsModal()" style="flex: 1; padding: 18px; font-size: 1.2em;">Fermer</button>
            </div>
        </form>
    `;
    modal.style.display = 'block';
}

async function handleEditSubmit(event) {
    event.preventDefault();
    const form = event.target;
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

    // Marquer comme non synchronisé et mettre à jour timestamps
    obs.synced = false;
    obs.updated_at = new Date().toISOString();
    obs.version = (obs.version || 0) + 1;
    normalizeObservation(obs);

    try {
        await saveObservation(obs);
        console.log('✅ Observation sauvegardée localement:', obs.id);

        closeDetailsModal();

        // Recharger et afficher
        allObservations = await getAllLocal();
        allObservations = allObservations.map(o => normalizeObservation(o));
        displayObservations(allObservations);

        // Synchroniser avec MongoDB si possible
        const isOnline = await checkConnection();
        if (isOnline && obs._id && isMongoId(obs._id)) {
            try {
                const mongoId = obs._id.toString();
                const url = `${API_BASE}/api/observations/${mongoId}`;

                const res = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(obs)
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.version) {
                        obs.version = data.version;
                    }
                    obs.synced = true;
                    await saveObservation(obs);
                    allObservations = await getAllLocal();
                    allObservations = allObservations.map(o => normalizeObservation(o));
                    displayObservations(allObservations);
                    showMessage('✅ Observation mise à jour et synchronisée', 'success');
                } else {
                    showMessage('💾 Observation enregistrée localement. Synchronisation en attente.', 'info');
                }
            } catch (syncErr) {
                console.error('Erreur de synchronisation:', syncErr);
                showMessage('💾 Observation enregistrée localement. Synchronisation en attente.', 'info');
            }
        } else {
            showMessage('💾 Observation enregistrée localement. Synchronisation en attente de connexion.', 'info');
        }
    } catch (err) {
        showMessage('❌ Erreur lors de la sauvegarde', 'error');
        console.error('Erreur de sauvegarde:', err);
    }
}

// ==================== CORRECTION 4: SUPPRESSION ROBUSTE ====================
async function deleteObservation(id) {
    if (!confirm('Supprimer cette observation ?')) return;

    const obs = findObservationById(id);
    if (!obs) {
        showMessage('❌ Observation introuvable', 'error');
        return;
    }

    try {
        const isOnline = await checkConnection();

        // Supprimer sur MongoDB si applicable
        if (isOnline && obs._id && isMongoId(obs._id)) {
            try {
                const mongoId = obs._id.toString();
                const res = await fetch(`${API_BASE}/api/observations/${mongoId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!res.ok) {
                    console.error('Échec suppression MongoDB:', res.status);
                }
            } catch (err) {
                console.error('Erreur suppression MongoDB:', err);
            }
        }

        // Supprimer localement
        await deleteLocal(obs.id);
        showMessage('✅ Observation supprimée', 'success');

        // Recharger et afficher
        allObservations = await getAllLocal();
        allObservations = allObservations.map(o => normalizeObservation(o));
        displayObservations(allObservations);

    } catch (err) {
        showMessage('❌ Erreur de suppression', 'error');
        console.error(err);
    }
}

// ==================== SYNCHRONISATION ====================
// CORRECTION 2: Synchronisation bidirectionnelle avec polling
async function backgroundSync() {
    const isOnline = await checkConnection();
    if (!isOnline) return;

    try {
        const res = await fetch(API_BASE + '/api/observations');
        if (!res.ok) return;

        const response = await res.json();
        const mongoData = Array.isArray(response) ? response :
            (response.observations || response.data || []);

        // Détecter les suppressions MongoDB
        const mongoIds = mongoData.map(o => (o._id || '').toString());
        const localObs = await getAllLocal();

        for (const local of localObs) {
            const localMongoId = (local._id || '').toString();
            if (localMongoId && !mongoIds.includes(localMongoId)) {
                // Supprimé sur MongoDB → supprimer localement
                await deleteLocal(local.id);
                console.log('🗑️ Supprimé localement (supprimé sur MongoDB):', local.id);
            }
        }

        // Synchroniser les modifications/ajouts
        for (const mongoObs of mongoData) {
            normalizeObservation(mongoObs);
            const localObs = findObservationById(mongoObs._id);

            if (!localObs) {
                mongoObs.synced = true;
                await saveObservation(mongoObs);
                console.log('📥 Nouvel observation synchronisée:', mongoObs.id);
            } else {
                const mongoTime = new Date(mongoObs.updated_at || mongoObs.created_at).getTime();
                const localTime = new Date(localObs.updated_at || localObs.created_at).getTime();

                if (mongoTime > localTime) {
                    mongoObs.id = localObs.id;
                    mongoObs.synced = true;
                    await saveObservation(mongoObs);
                    console.log('📥 Observation mise à jour:', mongoObs.id);
                }
            }
        }

        allObservations = await getAllLocal();
        allObservations = allObservations.map(obs => normalizeObservation(obs));
        displayObservations(allObservations);

    } catch (err) {
        console.error('Erreur sync background:', err);
    }
}

async function syncOne(id) {
    const obs = findObservationById(id);
    if (!obs) {
        showMessage('❌ Observation introuvable', 'error');
        return;
    }

    const isOnline = await checkConnection();
    if (!isOnline) {
        showMessage('❌ Pas de connexion', 'error');
        return;
    }

    try {
        normalizeObservation(obs);

        const method = (obs._id && isMongoId(obs._id)) ? 'PUT' : 'POST';
        const url = method === 'PUT' ? `${API_BASE}/api/observations/${obs._id.toString()}` : `${API_BASE}/api/observations`;

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(obs)
        });

        if (!res.ok) {
            showMessage('❌ Erreur de synchronisation', 'error');
            return;
        }

        const data = await res.json();
        if (data._id) {
            obs._id = data._id;
            obs.id = data._id.toString();
        }
        if (data.version) {
            obs.version = data.version;
        }
        obs.synced = true;
        obs.updated_at = new Date().toISOString();

        await saveObservation(obs);

        allObservations = await getAllLocal();
        allObservations = allObservations.map(o => normalizeObservation(o));
        displayObservations(allObservations);

        showMessage('✅ Observation synchronisée', 'success');

    } catch (err) {
        showMessage('❌ Erreur synchronisation', 'error');
        console.error(err);
    }
}

// ==================== EXPORT/IMPORT ====================
function exportOne(id) {
    const obs = findObservationById(id);
    if (!obs) {
        showMessage('❌ Observation introuvable', 'error');
        return;
    }

    const json = JSON.stringify(obs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `observation_${obs.date || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

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

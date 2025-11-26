const API_BASE = 'https://tramway-pwa-backend.onrender.com';
const DB_NAME = 'tramway-observations';
const STORE_NAME = 'observations';
const DB_VERSION = 1;

let db;
let allObservations = [];
let currentEditId = null;

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
            status.innerHTML = '<span class="status-indicator"></span><span>✅ Connecté à MongoDB</span>';
            return true;
        }
    } catch (err) {
        console.error('Connection error:', err);
    }
    
    const status = document.getElementById('status');
    status.className = 'status-bar status-offline';
    status.innerHTML = '<span class="status-indicator"></span><span>🔴 Hors ligne (Mode local)</span>';
    return false;
}

// ==================== NOUVELLE OBSERVATION ====================
function openNewObservationModal() {
    const modal = document.getElementById('new-observation-modal');
    const form = document.getElementById('observation-form');
    form.reset();
    document.querySelector('#observation-form input[name="date"]').value = new Date().toISOString().split('T')[0];
    
    const tbody = document.getElementById('comptage-table-new');
    tbody.innerHTML = `
        <tr>
            <td><input type="text" name="comptage_horaire[]" placeholder="HH:MM"></td>
            <td><input type="number" name="comptage_montees[]" min="0" value="0"></td>
            <td><input type="number" name="comptage_descentes[]" min="0" value="0"></td>
            <td><input type="number" name="comptage_attente[]" min="0" value="0"></td>
            <td><input type="text" name="comptage_observations[]" placeholder="Observations"></td>
        </tr>
    `;
    
    modal.style.display = 'block';
}

function closeNewObservationModal() {
    document.getElementById('new-observation-modal').style.display = 'none';
}

function addComptageRowNew() {
    const tbody = document.getElementById('comptage-table-new');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><input type="text" name="comptage_horaire[]" placeholder="HH:MM"></td>
        <td><input type="number" name="comptage_montees[]" min="0" value="0"></td>
        <td><input type="number" name="comptage_descentes[]" min="0" value="0"></td>
        <td><input type="number" name="comptage_attente[]" min="0" value="0"></td>
        <td><input type="text" name="comptage_observations[]" placeholder="Observations"></td>
    `;
    tbody.appendChild(newRow);
}

function addComptageRowEdit() {
    const tbody = document.getElementById('comptage-table-edit');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><input type="text" name="comptage_horaire[]" placeholder="HH:MM"></td>
        <td><input type="number" name="comptage_montees[]" min="0" value="0"></td>
        <td><input type="number" name="comptage_descentes[]" min="0" value="0"></td>
        <td><input type="number" name="comptage_attente[]" min="0" value="0"></td>
        <td><input type="text" name="comptage_observations[]" placeholder="Observations"></td>
    `;
    tbody.appendChild(newRow);
}

function getCheckboxValues(name, formElement) {
    const checkboxes = formElement.querySelectorAll('input[name="' + name + '"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function getComptageData(formElement) {
    const horaires = formElement.querySelectorAll('input[name="comptage_horaire[]"]');
    const montees = formElement.querySelectorAll('input[name="comptage_montees[]"]');
    const descentes = formElement.querySelectorAll('input[name="comptage_descentes[]"]');
    const attente = formElement.querySelectorAll('input[name="comptage_attente[]"]');
    const observations = formElement.querySelectorAll('input[name="comptage_observations[]"]');
    
    const comptage = [];
    for (let i = 0; i < horaires.length; i++) {
        const h = horaires[i].value;
        if (h || montees[i].value || descentes[i].value || attente[i].value || observations[i].value) {
            comptage.push({
                horaire: h,
                montees: montees[i].value,
                descentes: descentes[i].value,
                attente: attente[i].value,
                observations: observations[i].value
            });
        }
    }
    return comptage;
}

async function handleNewObservationSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    
    const observation = {
        id: Date.now(),
        date: formData.get('date') || new Date().toISOString().split('T')[0],
        jour: formData.get('jour') || '',
        heure_debut: formData.get('heure_debut') || '',
        heure_fin: formData.get('heure_fin') || '',
        duree_totale: formData.get('duree_totale') || '',
        lieu_station: formData.get('lieu_station') || '',
        quartier: formData.get('quartier') || '',
        meteo: getCheckboxValues('meteo', event.target),
        temperature: formData.get('temperature') || '',
        type_observation: formData.get('type_observation') || '',
        type_espace: getCheckboxValues('type_espace', event.target),
        intensite_interactions: formData.get('intensite_interactions') || '',
        nature_patrimoine: getCheckboxValues('nature_patrimoine', event.target),
        
        comptage_horaire: getComptageData(event.target),
        frequence_intervalle: formData.get('frequence_intervalle') || '',
        nombre_rames: formData.get('nombre_rames') || '',
        profil_hommes: formData.get('profil_hommes') || '',
        profil_femmes: formData.get('profil_femmes') || '',
        profil_enfants: formData.get('profil_enfants') || '',
        profil_adolescents: formData.get('profil_adolescents') || '',
        profil_adultes: formData.get('profil_adultes') || '',
        profil_ages: formData.get('profil_ages') || '',
        profil_pmr: formData.get('profil_pmr') || '',
        comportement_telephone: formData.get('comportement_telephone') || '',
        comportement_telephone_detail: formData.get('comportement_telephone_detail') || '',
        comportement_lecture: formData.get('comportement_lecture') || '',
        comportement_lecture_detail: formData.get('comportement_lecture_detail') || '',
        comportement_conversations: formData.get('comportement_conversations') || '',
        comportement_conversations_detail: formData.get('comportement_conversations_detail') || '',
        comportement_attente_assise: formData.get('comportement_attente_assise') || '',
        comportement_attente_assise_detail: formData.get('comportement_attente_assise_detail') || '',
        comportement_attente_debout: formData.get('comportement_attente_debout') || '',
        comportement_attente_debout_detail: formData.get('comportement_attente_debout_detail') || '',
        comportement_regard_fenetre: formData.get('comportement_regard_fenetre') || '',
        comportement_regard_fenetre_detail: formData.get('comportement_regard_fenetre_detail') || '',
        comportement_commerce: formData.get('comportement_commerce') || '',
        comportement_commerce_detail: formData.get('comportement_commerce_detail') || '',
        comportement_rassemblements: formData.get('comportement_rassemblements') || '',
        comportement_rassemblements_detail: formData.get('comportement_rassemblements_detail') || '',
        
        ambiance_sonore: formData.get('ambiance_sonore') || '',
        sons_dominants: formData.get('sons_dominants') || '',
        ambiance_visuelle: formData.get('ambiance_visuelle') || '',
        ambiance_olfactive: formData.get('ambiance_olfactive') || '',
        atmosphere_generale: formData.get('atmosphere_generale') || '',
        nature_interactions: formData.get('nature_interactions') || '',
        groupes_sociaux_identifies: formData.get('groupes_sociaux_identifies') || '',
        pratiques_sociales: formData.get('pratiques_sociales') || '',
        conversations_verbatim: formData.get('conversations_verbatim') || '',
        langues_utilisees: getCheckboxValues('langues_utilisees', event.target),
        thematiques_evoquees: formData.get('thematiques_evoquees') || '',
        elements_patrimoniaux: formData.get('elements_patrimoniaux') || '',
        etat_conservation: formData.get('etat_conservation') || '',
        perception_patrimoine: formData.get('perception_patrimoine') || '',
        
        impressions_generales: formData.get('impressions_generales') || '',
        elements_surprenants: formData.get('elements_surprenants') || '',
        tensions_conflits: formData.get('tensions_conflits') || '',
        appropriations_espace: formData.get('appropriations_espace') || '',
        hypothese_1: formData.get('hypothese_1') || '',
        hypothese_2: formData.get('hypothese_2') || '',
        hypothese_3: formData.get('hypothese_3') || '',
        
        notes_complementaires: formData.get('notes_complementaires') || '',
        pistes_prochaine: formData.get('pistes_prochaine') || '',
        questions_methodologiques: formData.get('questions_methodologiques') || '',
        
        synced: false,
        created_at: new Date().toISOString()
    };

    try {
        const isOnline = await checkConnection();

        if (isOnline) {
            const res = await fetch(API_BASE + '/api/observations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(observation)
            });
            
            if (res.ok) {
                observation.synced = true;
                showMessage('✅ Observation enregistrée et synchronisée avec le serveur !', 'success');
            }
        }

        await saveObservation(observation);
        
        if (!observation.synced) {
            showMessage('💾 Observation enregistrée localement. Synchronisation en attente de connexion.', 'success');
        }

        closeNewObservationModal();
        await loadAndDisplay();

    } catch (error) {
        console.error('Erreur lors de la soumission:', error);
        try {
            await saveObservation(observation);
            showMessage('⚠️ Erreur réseau. Observation enregistrée localement pour synchronisation ultérieure.', 'error');
            closeNewObservationModal();
            await loadAndDisplay();
        } catch (dbError) {
            showMessage('❌ Erreur critique: Impossible d\'enregistrer localement.', 'error');
        }
    }
}

// ==================== AFFICHAGE DES OBSERVATIONS ====================
async function loadAndDisplay() {
    console.log('🔄 Démarrage loadAndDisplay...');
    const isOnline = await checkConnection();
    
    if (isOnline) {
        try {
            console.log('📥 Tentative de chargement depuis MongoDB...');
            const res = await fetch(API_BASE + '/api/observations', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            console.log('📡 Réponse reçue, status:', res.status);
            
            if (res.ok) {
                const responseData = await res.json();
                console.log('📦 Données brutes reçues:', responseData);
                
                let mongoData = [];
                
                if (Array.isArray(responseData)) {
                    mongoData = responseData;
                    console.log('📊 Format détecté: Tableau direct');
                } else if (typeof responseData === 'object' && responseData !== null) {
                    if (Array.isArray(responseData.observations)) {
                        mongoData = responseData.observations;
                        console.log('📊 Format détecté: Objet avec propriété "observations"');
                    } else if (Array.isArray(responseData.data)) {
                        mongoData = responseData.data;
                        console.log('📊 Format détecté: Objet avec propriété "data"');
                    } else if (Array.isArray(responseData.results)) {
                        mongoData = responseData.results;
                        console.log('📊 Format détecté: Objet avec propriété "results"');
                    } else {
                        const keys = Object.keys(responseData);
                        for (const key of keys) {
                            if (Array.isArray(responseData[key])) {
                                mongoData = responseData[key];
                                console.log('📊 Format détecté: Objet avec propriété "' + key + '"');
                                break;
                            }
                        }
                    }
                }
                
                if (!Array.isArray(mongoData)) {
                    console.error('❌ ERREUR: Impossible de trouver un tableau dans la réponse!');
                    console.error('Structure reçue:', responseData);
                    mongoData = [];
                }
                
                console.log('✅ Observations extraites:', mongoData.length);
                if (mongoData.length > 0) {
                    console.log('📋 Premier élément:', mongoData[0]);
                }
                
                let savedCount = 0;
                for (const obs of mongoData) {
                    try {
                        if (!obs.id) {
                            obs.id = obs._id || Date.now() + Math.random();
                        }
                        obs.synced = true;
                        await saveObservation(obs);
                        savedCount++;
                    } catch (err) {
                        console.error('❌ Erreur sauvegarde observation:', err);
                    }
                }
                
                console.log('💾 Observations sauvegardées localement:', savedCount);
                
                if (mongoData.length > 0) {
                    showMessage('✅ ' + mongoData.length + ' observations chargées depuis le serveur', 'success');
                } else {
                    console.log('ℹ️ Aucune observation sur le serveur');
                }
            } else {
                console.warn('⚠️ Réponse non-OK:', res.status);
            }
        } catch (err) {
            console.error('❌ Erreur de chargement MongoDB:', err);
            showMessage('⚠️ Impossible de charger depuis le serveur. Données locales affichées.', 'info');
        }
    } else {
        console.log('🔴 Mode hors ligne');
    }
    
    try {
        allObservations = await getAllLocal();
        console.log('📊 Observations locales chargées:', allObservations.length);
        displayObservations(allObservations);
    } catch (err) {
        console.error('❌ Erreur chargement local:', err);
        displayObservations([]);
    }
}

function displayObservations(observations) {
    const container = document.getElementById('observations-list');
    
    if (!observations || !Array.isArray(observations) || observations.length === 0) {
        container.innerHTML = '<div class="empty-state"><div style="font-size: 4em;">📋</div><h3>Aucune observation</h3><p>Créez votre première observation ou importez un fichier JSON</p></div>';
        return;
    }

    observations.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = observations.map(obs => {
        const obsId = obs.id || obs._id;
        return '<div class="observation-card"><div class="observation-header"><div><div class="observation-title">' + (obs.lieu_station || 'Station non définie') + '</div><div style="color: #666; margin-top: 5px;">📅 ' + formatDate(obs.date) + ' ' + (obs.jour || '') + ' • ⏰ ' + (obs.heure_debut || '') + ' - ' + (obs.heure_fin || '') + '</div></div><span class="sync-badge ' + (obs.synced ? 'synced' : 'pending') + '">' + (obs.synced ? '✓ Sync' : '⏳ Local') + '</span></div><div class="observation-meta"><div class="meta-item"><span class="meta-label">Type</span>' + (obs.type_observation || 'N/A') + '</div><div class="meta-item"><span class="meta-label">Météo</span>' + (Array.isArray(obs.meteo) ? obs.meteo.join(', ') : obs.meteo || 'N/A') + '</div><div class="meta-item"><span class="meta-label">Température</span>' + (obs.temperature || 'N/A') + '°C</div></div>' + (obs.impressions_generales ? '<div class="observation-content"><strong>Impressions:</strong><br>' + obs.impressions_generales.substring(0, 200) + (obs.impressions_generales.length > 200 ? '...' : '') + '</div>' : '') + '<div class="observation-actions"><button class="btn btn-info btn-small" onclick="viewDetails(' + obsId + ')">👁️ Voir détails</button><button class="btn btn-warning btn-small" onclick="deleteObservation(' + obsId + ')">🗑️ Supprimer</button>' + (!obs.synced ? '<button class="btn btn-secondary btn-small" onclick="syncOne(' + obsId + ')">🔄 Sync</button>' : '') + '</div></div>';
    }).join('');
}

function formatDate(dateStr) {
    try {
        return new Date(dateStr).toLocaleDateString('fr-FR');
    } catch {
        return dateStr;
    }
}

// ==================== DÉTAILS ET ÉDITION ====================
function viewDetails(id) {
    const obs = allObservations.find(o => (o.id === id || o._id === id));
    if (!obs) return;

    currentEditId = id;
    const modal = document.getElementById('details-modal');
    const body = document.getElementById('modal-body');
    
    body.innerHTML = generateEditForm(obs);
    
    modal.style.display = 'block';
}

function generateEditForm(obs) {
    const obsId = obs.id || obs._id;
    
    // Fonction helper pour générer les checkboxes
    const makeCheckbox = (name, value, checked) => {
        return '<div class="checkbox-item"><input type="checkbox" name="' + name + '" value="' + value + '" ' + (checked ? 'checked' : '') + '><label>' + value + '</label></div>';
    };
    
    // Fonction helper pour générer les options de select
    const makeOption = (value, selected, label) => {
        return '<option value="' + value + '" ' + (selected ? 'selected' : '') + '>' + (label || value) + '</option>';
    };
    
    // Générer les lignes du tableau de comptage
    let comptageRows = '';
    if (obs.comptage_horaire && obs.comptage_horaire.length > 0) {
        obs.comptage_horaire.forEach(row => {
            comptageRows += '<tr>';
            comptageRows += '<td><input type="text" name="comptage_horaire[]" value="' + (row.horaire || '') + '" placeholder="HH:MM"></td>';
            comptageRows += '<td><input type="number" name="comptage_montees[]" value="' + (row.montees || 0) + '" min="0"></td>';
            comptageRows += '<td><input type="number" name="comptage_descentes[]" value="' + (row.descentes || 0) + '" min="0"></td>';
            comptageRows += '<td><input type="number" name="comptage_attente[]" value="' + (row.attente || 0) + '" min="0"></td>';
            comptageRows += '<td><input type="text" name="comptage_observations[]" value="' + (row.observations || '') + '" placeholder="Observations"></td>';
            comptageRows += '</tr>';
        });
    } else {
        comptageRows = '<tr><td><input type="text" name="comptage_horaire[]" placeholder="HH:MM"></td><td><input type="number" name="comptage_montees[]" min="0" value="0"></td><td><input type="number" name="comptage_descentes[]" min="0" value="0"></td><td><input type="number" name="comptage_attente[]" min="0" value="0"></td><td><input type="text" name="comptage_observations[]" placeholder="Observations"></td></tr>';
    }
    
    // Générer les checkboxes météo
    let meteoChecks = '';
    const meteoOptions = ['Ensoleillé', 'Nuageux', 'Pluie', 'Vent'];
    const meteoSelected = Array.isArray(obs.meteo) ? obs.meteo : [];
    meteoOptions.forEach(opt => {
        meteoChecks += makeCheckbox('meteo', opt, meteoSelected.includes(opt));
    });
    
    // Générer les checkboxes type_espace
    let espaceChecks = '';
    const espaceOptions = ['TE-S: Station de tramway', 'TE-B: À bord du tramway', 'TE-A: Abords immédiats (<50m)', 'TE-P: Espace public connexe', 'TE-C: Corridor/axe du tramway'];
    const espaceSelected = Array.isArray(obs.type_espace) ? obs.type_espace : [];
    espaceOptions.forEach(opt => {
        espaceChecks += makeCheckbox('type_espace', opt, espaceSelected.includes(opt));
    });
    
    // Générer les checkboxes nature_patrimoine
    let patrimoineChecks = '';
    const patrimoineOptions = ['NP-A: Architecture coloniale', 'NP-B: Bâti traditionnel', 'NP-C: Architecture moderne/contemporaine', 'NP-P: Patrimoine paysager', 'NP-I: Patrimoine immatériel', 'NP-M: Patrimoine mémoriel'];
    const patrimoineSelected = Array.isArray(obs.nature_patrimoine) ? obs.nature_patrimoine : [];
    patrimoineOptions.forEach(opt => {
        patrimoineChecks += makeCheckbox('nature_patrimoine', opt, patrimoineSelected.includes(opt));
    });
    
    // Générer les checkboxes langues
    let languesChecks = '';
    const languesOptions = ['Arabe dialectal', 'Français', 'Tamazight', 'Mixte'];
    const languesSelected = Array.isArray(obs.langues_utilisees) ? obs.langues_utilisees : [];
    languesOptions.forEach(opt => {
        languesChecks += makeCheckbox('langues_utilisees', opt, languesSelected.includes(opt));
    });
    
    // Commencer à construire le formulaire
    let html = '<form id="edit-form" onsubmit="handleEditSubmit(event)">';
    
    // SECTION IDENTIFICATION
    html += '<div class="form-section"><h3>📋 IDENTIFICATION DE LA SESSION</h3>';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Date *</label><input type="date" name="date" value="' + (obs.date || '') + '" required></div>';
    html += '<div class="form-group"><label>Jour</label><select name="jour"><option value="">Sélectionner</option>';
    ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].forEach(j => {
        html += makeOption(j, obs.jour === j);
    });
    html += '</select></div></div>';
    
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Heure début</label><input type="time" name="heure_debut" value="' + (obs.heure_debut || '') + '"></div>';
    html += '<div class="form-group"><label>Heure fin</label><input type="time" name="heure_fin" value="' + (obs.heure_fin || '') + '"></div>';
    html += '<div class="form-group"><label>Durée totale (min)</label><input type="number" name="duree_totale" value="' + (obs.duree_totale || '') + '" min="0"></div>';
    html += '</div>';
    
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Station/Tronçon</label><input type="text" name="lieu_station" value="' + (obs.lieu_station || '') + '"></div>';
    html += '<div class="form-group"><label>Quartier</label><input type="text" name="quartier" value="' + (obs.quartier || '') + '"></div>';
    html += '</div>';
    
    html += '<div class="form-group"><label>Météo (plusieurs choix possibles)</label><div class="checkbox-group">' + meteoChecks + '</div></div>';
    
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Température estimée (°C)</label><input type="number" name="temperature" value="' + (obs.temperature || '') + '" min="-10" max="60"></div>';
    html += '<div class="form-group"><label>Type d\'observation</label><select name="type_observation"><option value="">Sélectionner</option>';
    ['Statique (poste fixe)', 'Mobile (parcours)', 'Mixte'].forEach(t => {
        html += makeOption(t, obs.type_observation === t);
    });
    html += '</select></div></div>';
    
    html += '<div class="form-group"><label>Type d\'espace observé (TE) - MULTICHOIX</label><div class="checkbox-group">' + espaceChecks + '</div></div>';
    
    html += '<div class="form-group"><label>Intensité des interactions (II)</label><select name="intensite_interactions"><option value="">Sélectionner</option>';
    ['II-1: Faible (interactions isolées)', 'II-2: Modérée (interactions régulières)', 'II-3: Forte (espace très animé)', 'II-4: Très forte (événement/concentration)'].forEach(i => {
        html += makeOption(i, obs.intensite_interactions === i);
    });
    html += '</select></div>';
    
    html += '<div class="form-group"><label>Nature du patrimoine visible (NP) - MULTICHOIX</label><div class="checkbox-group">' + patrimoineChecks + '</div></div>';
    html += '</div>'; // Fin SECTION IDENTIFICATION
    
    // SECTION 1: DONNÉES QUANTITATIVES
    html += '<div class="form-section"><h3>📊 SECTION 1: DONNÉES QUANTITATIVES</h3>';
    html += '<h4>Flux et Fréquentation</h4>';
    html += '<div class="form-group"><label>Comptage des usagers</label>';
    html += '<table class="counting-table"><thead><tr><th>Horaire</th><th>Montées</th><th>Descentes</th><th>Attente</th><th>Observations</th></tr></thead>';
    html += '<tbody id="comptage-table-edit">' + comptageRows + '</tbody></table>';
    html += '<button type="button" class="add-row-btn" onclick="addComptageRowEdit()">➕ Ajouter une ligne</button></div>';
    
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Fréquence des rames - Intervalle moyen (min)</label><input type="number" name="frequence_intervalle" value="' + (obs.frequence_intervalle || '') + '" min="0"></div>';
    html += '<div class="form-group"><label>Nombre de rames passées</label><input type="number" name="nombre_rames" value="' + (obs.nombre_rames || '') + '" min="0"></div>';
    html += '</div>';
    
    html += '<h4>Profil des Usagers (% approximatif)</h4>';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Hommes (%)</label><input type="number" name="profil_hommes" value="' + (obs.profil_hommes || '') + '" min="0" max="100"></div>';
    html += '<div class="form-group"><label>Femmes (%)</label><input type="number" name="profil_femmes" value="' + (obs.profil_femmes || '') + '" min="0" max="100"></div>';
    html += '<div class="form-group"><label>Enfants &lt; 12 ans (%)</label><input type="number" name="profil_enfants" value="' + (obs.profil_enfants || '') + '" min="0" max="100"></div>';
    html += '</div>';
    
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Adolescents 12-18 (%)</label><input type="number" name="profil_adolescents" value="' + (obs.profil_adolescents || '') + '" min="0" max="100"></div>';
    html += '<div class="form-group"><label>Adultes 18-65 (%)</label><input type="number" name="profil_adultes" value="' + (obs.profil_adultes || '') + '" min="0" max="100"></div>';
    html += '<div class="form-group"><label>Personnes âgées &gt; 65 (%)</label><input type="number" name="profil_ages" value="' + (obs.profil_ages || '') + '" min="0" max="100"></div>';
    html += '</div>';
    
    html += '<div class="form-group"><label>PMR (Personnes à Mobilité Réduite) (%)</label><input type="number" name="profil_pmr" value="' + (obs.profil_pmr || '') + '" min="0" max="100"></div>';
    
    html += '<h4>Comportements Observables</h4>';
    html += '<div class="form-group">';
    html += '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_telephone" value="oui" ' + (obs.comportement_telephone ? 'checked' : '') + '><label>Utilisation du téléphone</label><input type="text" name="comportement_telephone_detail" value="' + (obs.comportement_telephone_detail || '') + '" placeholder="% ou détails"></div>';
    html += '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_lecture" value="oui" ' + (obs.comportement_lecture ? 'checked' : '') + '><label>Lecture/journal</label><input type="text" name="comportement_lecture_detail" value="' + (obs.comportement_lecture_detail || '') + '" placeholder="% ou détails"></div>';
    html += '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_conversations" value="oui" ' + (obs.comportement_conversations ? 'checked' : '') + '><label>Conversations</label><input type="text" name="comportement_conversations_detail" value="' + (obs.comportement_conversations_detail || '') + '" placeholder="% ou détails"></div>';
    html += '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_attente_assise" value="oui" ' + (obs.comportement_attente_assise ? 'checked' : '') + '><label>Attente assise</label><input type="text" name="comportement_attente_assise_detail" value="' + (obs.comportement_attente_assise_detail || '') + '" placeholder="% ou détails"></div>';
    html += '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_attente_debout" value="oui" ' + (obs.comportement_attente_debout ? 'checked' : '') + '><label>Attente debout</label><input type="text" name="comportement_attente_debout_detail" value="' + (obs.comportement_attente_debout_detail || '') + '" placeholder="% ou détails"></div>';
    html += '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_regard_fenetre" value="oui" ' + (obs.comportement_regard_fenetre ? 'checked' : '') + '><label>Regarder à travers la fenêtre/dans le vide</label><input type="text" name="comportement_regard_fenetre_detail" value="' + (obs.comportement_regard_fenetre_detail || '') + '" placeholder="% ou détails"></div>';
    html += '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_commerce" value="oui" ' + (obs.comportement_commerce ? 'checked' : '') + '><label>Activités commerciales informelles</label><input type="text" name="comportement_commerce_detail" value="' + (obs.comportement_commerce_detail || '') + '" placeholder="% ou détails"></div>';
    html += '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_rassemblements" value="oui" ' + (obs.comportement_rassemblements ? 'checked' : '') + '><label>Rassemblements/groupes</label><input type="text" name="comportement_rassemblements_detail" value="' + (obs.comportement_rassemblements_detail || '') + '" placeholder="% ou détails"></div>';
    html += '</div></div>'; // Fin SECTION 1
    
    // SECTION 2: DONNÉES QUALITATIVES
    html += '<div class="form-section"><h3>🎨 SECTION 2: DONNÉES QUALITATIVES</h3>';
    html += '<h4>Ambiances Urbaines</h4>';
    html += '<div class="form-group"><label>Ambiance sonore</label><select name="ambiance_sonore"><option value="">Sélectionner</option>';
    ['Silencieux', 'Calme', 'Animé', 'Bruyant', 'Très bruyant'].forEach(a => {
        html += makeOption(a, obs.ambiance_sonore === a);
    });
    html += '</select></div>';
    
    html += '<div class="form-group"><label>Sons dominants</label><textarea name="sons_dominants">' + (obs.sons_dominants || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Ambiance visuelle</label><textarea name="ambiance_visuelle">' + (obs.ambiance_visuelle || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Ambiance olfactive</label><textarea name="ambiance_olfactive">' + (obs.ambiance_olfactive || '') + '</textarea></div>';
    
    html += '<div class="form-group"><label>Atmosphère générale</label><select name="atmosphere_generale"><option value="">Sélectionner</option>';
    ['Apaisée', 'Tendue', 'Conviviale', 'Anonyme', 'Festive'].forEach(a => {
        html += makeOption(a, obs.atmosphere_generale === a);
    });
    html += '</select></div>';
    
    html += '<h4>Interactions Sociales Observées</h4>';
    html += '<div class="form-group"><label>Nature des interactions</label><textarea name="nature_interactions">' + (obs.nature_interactions || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Groupes sociaux identifiés</label><textarea name="groupes_sociaux_identifies">' + (obs.groupes_sociaux_identifies || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Pratiques sociales remarquables</label><textarea name="pratiques_sociales">' + (obs.pratiques_sociales || '') + '</textarea></div>';
    
    html += '<h4>Perceptions et Discours Captés</h4>';
    html += '<div class="form-group"><label>Conversations entendues (verbatim)</label><textarea name="conversations_verbatim">' + (obs.conversations_verbatim || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Langue(s) utilisée(s)</label><div class="checkbox-group">' + languesChecks + '</div></div>';
    html += '<div class="form-group"><label>Thématiques évoquées</label><textarea name="thematiques_evoquees">' + (obs.thematiques_evoquees || '') + '</textarea></div>';
    
    html += '<h4>Patrimoine et Mémoire</h4>';
    html += '<div class="form-group"><label>Éléments patrimoniaux visibles</label><textarea name="elements_patrimoniaux">' + (obs.elements_patrimoniaux || '') + '</textarea></div>';
    html += '<div class="form-group"><label>État de conservation</label><select name="etat_conservation"><option value="">Sélectionner</option>';
    ['Excellent', 'Bon', 'Moyen', 'Dégradé', 'Ruine'].forEach(e => {
        html += makeOption(e, obs.etat_conservation === e);
    });
    html += '</select></div>';
    
    html += '<div class="form-group"><label>Perception du patrimoine par les usagers</label><select name="perception_patrimoine"><option value="">Sélectionner</option>';
    ['Valorisé', 'Ignoré', 'Détourné', 'Approprié', 'Rejeté'].forEach(p => {
        html += makeOption(p, obs.perception_patrimoine === p);
    });
    html += '</select></div></div>'; // Fin SECTION 2
    
    // SECTION 4: RÉFLEXIONS POST-OBSERVATION
    html += '<div class="form-section"><h3>💭 SECTION 4: RÉFLEXIONS POST-OBSERVATION</h3>';
    html += '<h4>Analyse à Chaud</h4>';
    html += '<div class="form-group"><label>Impressions générales</label><textarea name="impressions_generales">' + (obs.impressions_generales || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Éléments surprenants/inattendus</label><textarea name="elements_surprenants">' + (obs.elements_surprenants || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Tensions ou conflits d\'usage observés</label><textarea name="tensions_conflits">' + (obs.tensions_conflits || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Appropriations remarquables de l\'espace</label><textarea name="appropriations_espace">' + (obs.appropriations_espace || '') + '</textarea></div>';
    
    html += '<h4>Hypothèses Émergentes</h4>';
    html += '<div class="form-group"><label>Hypothèse 1</label><textarea name="hypothese_1">' + (obs.hypothese_1 || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Hypothèse 2</label><textarea name="hypothese_2">' + (obs.hypothese_2 || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Hypothèse 3</label><textarea name="hypothese_3">' + (obs.hypothese_3 || '') + '</textarea></div></div>'; // Fin SECTION 4
    
    // SECTION 5: NOTES COMPLÉMENTAIRES
    html += '<div class="form-section"><h3>📝 SECTION 5: NOTES COMPLÉMENTAIRES</h3>';
    html += '<div class="form-group"><label>Notes supplémentaires</label><textarea name="notes_complementaires" style="min-height: 150px;">' + (obs.notes_complementaires || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Pistes pour la prochaine observation</label><textarea name="pistes_prochaine">' + (obs.pistes_prochaine || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Questions méthodologiques</label><textarea name="questions_methodologiques">' + (obs.questions_methodologiques || '') + '</textarea></div></div>'; // Fin SECTION 5
    
    // Boutons d'action
    html += '<div style="display: flex; gap: 10px; margin-top: 20px;">';
    html += '<button type="submit" class="btn btn-primary" style="flex: 1; padding: 18px; font-size: 1.2em;">💾 Enregistrer</button>';
    html += '<button type="button" class="btn btn-warning" onclick="exportOne(' + obsId + ')" style="flex: 1; padding: 18px; font-size: 1.2em;">📥 Exporter</button>';
    html += '</div></form>';
    
    return html;
}

function closeDetailsModal() {
    document.getElementById('details-modal').style.display = 'none';
    currentEditId = null;
}

async function handleEditSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const obs = allObservations.find(o => (o.id === currentEditId || o._id === currentEditId));
    
    if (!obs) return;

    // Mise à jour de TOUS les champs
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
    
    obs.synced = false;

    try {
        await saveObservation(obs);
        showMessage('✅ Observation mise à jour avec succès', 'success');
        closeDetailsModal();
        await loadAndDisplay();
    } catch (err) {
        showMessage('❌ Erreur lors de la sauvegarde', 'error');
        console.error(err);
    }
}

// ==================== SYNCHRONISATION ====================
async function syncOne(id) {
    const obs = allObservations.find(o => (o.id === id || o._id === id));
    if (!obs) return;

    const isOnline = await checkConnection();
    if (!isOnline) {
        showMessage('❌ Pas de connexion', 'error');
        return;
    }

    try {
        const res = await fetch(API_BASE + '/api/observations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(obs)
        });

        if (res.ok) {
            obs.synced = true;
            await saveObservation(obs);
            showMessage('✅ Observation synchronisée', 'success');
            loadAndDisplay();
        } else {
            throw new Error('Sync failed');
        }
    } catch (err) {
        showMessage('❌ Erreur de synchronisation', 'error');
    }
}

async function syncAll() {
    const btn = document.getElementById('sync-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Synchronisation...';

    const isOnline = await checkConnection();
    if (!isOnline) {
        showMessage('❌ Pas de connexion Internet', 'error');
        btn.disabled = false;
        btn.textContent = '🔄 Synchroniser';
        return;
    }

    const pending = allObservations.filter(o => !o.synced);
    
    if (pending.length === 0) {
        showMessage('✅ Tout est déjà synchronisé', 'info');
        btn.disabled = false;
        btn.textContent = '🔄 Synchroniser';
        return;
    }

    let success = 0;
    for (const obs of pending) {
        try {
            const res = await fetch(API_BASE + '/api/observations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(obs)
            });

            if (res.ok) {
                obs.synced = true;
                await saveObservation(obs);
                success++;
            }
        } catch (err) {
            console.error('Sync error:', err);
        }
    }

    showMessage('✅ ' + success + '/' + pending.length + ' observations synchronisées', 'success');
    btn.disabled = false;
    btn.textContent = '🔄 Synchroniser';
    loadAndDisplay();
}

// ==================== SUPPRESSION ====================
async function deleteObservation(id) {
    if (!confirm('Supprimer cette observation ?')) return;
    
    try {
        await deleteLocal(id);
        showMessage('✅ Observation supprimée', 'success');
        loadAndDisplay();
    } catch (err) {
        showMessage('❌ Erreur de suppression', 'error');
    }
}

// ==================== IMPORT/EXPORT ====================
function importFile() {
    document.getElementById('file-input').click();
}

async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const observations = Array.isArray(data) ? data : [data];
            
            let imported = 0;
            for (const obs of observations) {
                if (!obs.id) obs.id = Date.now() + Math.random();
                obs.synced = false;
                await saveObservation(obs);
                imported++;
            }
            
            showMessage('✅ ' + imported + ' observation(s) importée(s)', 'success');
            loadAndDisplay();
        } catch (err) {
            showMessage('❌ Fichier JSON invalide', 'error');
            console.error(err);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function exportAll() {
    if (allObservations.length === 0) {
        showMessage('⚠️ Aucune observation à exporter', 'info');
        return;
    }

    const json = JSON.stringify(allObservations, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'observations_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showMessage('✅ Export réussi', 'success');
}

function exportOne(id) {
    const obs = allObservations.find(o => (o.id === id || o._id === id));
    if (!obs) return;

    const json = JSON.stringify(obs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'observation_' + (obs.lieu_station || 'sans-nom') + '_' + obs.date + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showMessage('✅ Observation exportée', 'success');
}

// ==================== RECHERCHE/FILTRAGE ====================
function filterObservations() {
    const search = document.getElementById('search').value.toLowerCase();
    const filtered = allObservations.filter(obs => 
        (obs.lieu_station || '').toLowerCase().includes(search) ||
        (obs.date || '').includes(search) ||
        (obs.impressions_generales || '').toLowerCase().includes(search) ||
        (obs.jour || '').toLowerCase().includes(search)
    );
    displayObservations(filtered);
}

// ==================== MESSAGES ====================
function showMessage(text, type) {
    const msg = document.getElementById('message');
    msg.className = 'message ' + type;
    msg.textContent = text;
    msg.style.display = 'block';
    setTimeout(function() { msg.style.display = 'none'; }, 5000);
}

// ==================== INITIALISATION ====================
window.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('🚀 Initialisation de l\'application...');
        await initDB();
        console.log('✅ Base de données initialisée');
        
        await checkConnection();
        await loadAndDisplay();
        
        setInterval(checkConnection, 30000);
        
        console.log('✅ Application PWA prête');
    } catch (error) {
        console.error('❌ Erreur d\'initialisation:', error);
        showMessage('❌ Erreur d\'initialisation de l\'application', 'error');
    }
});
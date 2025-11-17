const API_BASE = 'https://tramway-pwa-backend.onrender.com';
const DB_NAME = 'tramway-observations';
const STORE_NAME = 'observations';
const DB_VERSION = 1;

let db;
let allObservations = [];
let currentEditId = null;

// ==================== BASE DE DONNÃ‰ES ====================
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
            status.innerHTML = '<span class="status-indicator"></span><span>âœ… ConnectÃ© Ã  MongoDB</span>';
            return true;
        }
    } catch (err) {
        console.error('Connection error:', err);
    }
    
    const status = document.getElementById('status');
    status.className = 'status-bar status-offline';
    status.innerHTML = '<span class="status-indicator"></span><span>ðŸ"´ Hors ligne (Mode local)</span>';
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
                showMessage('âœ… Observation enregistrÃ©e et synchronisÃ©e avec le serveur !', 'success');
            }
        }

        await saveObservation(observation);
        
        if (!observation.synced) {
            showMessage('ðŸ'¾ Observation enregistrÃ©e localement. Synchronisation en attente de connexion.', 'success');
        }

        closeNewObservationModal();
        await loadAndDisplay();

    } catch (error) {
        console.error('Erreur lors de la soumission:', error);
        try {
            await saveObservation(observation);
            showMessage('âš ï¸ Erreur rÃ©seau. Observation enregistrÃ©e localement pour synchronisation ultÃ©rieure.', 'error');
            closeNewObservationModal();
            await loadAndDisplay();
        } catch (dbError) {
            showMessage('âŒ Erreur critique: Impossible d\'enregistrer localement.', 'error');
        }
    }
}

// ==================== AFFICHAGE DES OBSERVATIONS ====================
async function loadAndDisplay() {
    console.log('ðŸ"„ DÃ©marrage loadAndDisplay...');
    const isOnline = await checkConnection();
    
    if (isOnline) {
        try {
            console.log('ðŸ"¥ Tentative de chargement depuis MongoDB...');
            const res = await fetch(API_BASE + '/api/observations', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            console.log('ðŸ"¡ RÃ©ponse reÃ§ue, status:', res.status);
            
            if (res.ok) {
                const responseData = await res.json();
                console.log('ðŸ"¦ DonnÃ©es brutes reÃ§ues:', responseData);
                
                // âœ… FIX FINAL: GÃ©rer TOUS les formats possibles
                let mongoData = [];
                
                if (Array.isArray(responseData)) {
                    // Format 1: Tableau direct [ {...}, {...} ]
                    mongoData = responseData;
                    console.log('ðŸ"Š Format dÃ©tectÃ©: Tableau direct');
                } else if (typeof responseData === 'object' && responseData !== null) {
                    // C'est un objet, chercher le tableau
                    if (Array.isArray(responseData.observations)) {
                        // Format 2: { observations: [...], success: true, count: 11 }
                        mongoData = responseData.observations;
                        console.log('ðŸ"Š Format dÃ©tectÃ©: Objet avec propriÃ©tÃ© "observations"');
                    } else if (Array.isArray(responseData.data)) {
                        // Format 3: { data: [...] }
                        mongoData = responseData.data;
                        console.log('ðŸ"Š Format dÃ©tectÃ©: Objet avec propriÃ©tÃ© "data"');
                    } else if (Array.isArray(responseData.results)) {
                        // Format 4: { results: [...] }
                        mongoData = responseData.results;
                        console.log('ðŸ"Š Format dÃ©tectÃ©: Objet avec propriÃ©tÃ© "results"');
                    } else {
                        // Chercher n'importe quelle propriÃ©tÃ© qui est un tableau
                        const keys = Object.keys(responseData);
                        for (const key of keys) {
                            if (Array.isArray(responseData[key])) {
                                mongoData = responseData[key];
                                console.log('ðŸ"Š Format dÃ©tectÃ©: Objet avec propriÃ©tÃ© "' + key + '"');
                                break;
                            }
                        }
                    }
                }
                
                // VÃ©rification finale
                if (!Array.isArray(mongoData)) {
                    console.error('âŒ ERREUR: Impossible de trouver un tableau dans la rÃ©ponse!');
                    console.error('Structure reÃ§ue:', responseData);
                    mongoData = [];
                }
                
                console.log('âœ… Observations extraites:', mongoData.length);
                if (mongoData.length > 0) {
                    console.log('ðŸ"‹ Premier Ã©lÃ©ment:', mongoData[0]);
                }
                
                // Sauvegarder localement TOUTES les observations
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
                        console.error('âŒ Erreur sauvegarde observation:', err);
                    }
                }
                
                console.log('ðŸ'¾ Observations sauvegardÃ©es localement:', savedCount);
                
                if (mongoData.length > 0) {
                    showMessage('âœ… ' + mongoData.length + ' observations chargÃ©es depuis le serveur', 'success');
                } else {
                    console.log('â„¹ï¸ Aucune observation sur le serveur');
                }
            } else {
                console.warn('âš ï¸ RÃ©ponse non-OK:', res.status);
            }
        } catch (err) {
            console.error('âŒ Erreur de chargement MongoDB:', err);
            showMessage('âš ï¸ Impossible de charger depuis le serveur. DonnÃ©es locales affichÃ©es.', 'info');
        }
    } else {
        console.log('ðŸ"´ Mode hors ligne');
    }
    
    // Charger et afficher les donnÃ©es locales
    try {
        allObservations = await getAllLocal();
        console.log('ðŸ"Š Observations locales chargÃ©es:', allObservations.length);
        displayObservations(allObservations);
    } catch (err) {
        console.error('âŒ Erreur chargement local:', err);
        displayObservations([]);
    }
}

function displayObservations(observations) {
    const container = document.getElementById('observations-list');
    
    // âœ… FIX: VÃ©rifier que observations est bien un tableau
    if (!observations || !Array.isArray(observations) || observations.length === 0) {
        container.innerHTML = '<div class="empty-state"><div style="font-size: 4em;">ðŸ"‹</div><h3>Aucune observation</h3><p>CrÃ©ez votre premiÃ¨re observation ou importez un fichier JSON</p></div>';
        return;
    }

    observations.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = observations.map(obs => {
        const obsId = obs.id || obs._id;
        return '<div class="observation-card"><div class="observation-header"><div><div class="observation-title">' + (obs.lieu_station || 'Station non dÃ©finie') + '</div><div style="color: #666; margin-top: 5px;">ðŸ"… ' + formatDate(obs.date) + ' ' + (obs.jour || '') + ' â€¢ â° ' + (obs.heure_debut || '') + ' - ' + (obs.heure_fin || '') + '</div></div><span class="sync-badge ' + (obs.synced ? 'synced' : 'pending') + '">' + (obs.synced ? 'âœ" Sync' : 'â³ Local') + '</span></div><div class="observation-meta"><div class="meta-item"><span class="meta-label">Type</span>' + (obs.type_observation || 'N/A') + '</div><div class="meta-item"><span class="meta-label">MÃ©tÃ©o</span>' + (Array.isArray(obs.meteo) ? obs.meteo.join(', ') : obs.meteo || 'N/A') + '</div><div class="meta-item"><span class="meta-label">TempÃ©rature</span>' + (obs.temperature || 'N/A') + 'Â°C</div></div>' + (obs.impressions_generales ? '<div class="observation-content"><strong>Impressions:</strong><br>' + obs.impressions_generales.substring(0, 200) + (obs.impressions_generales.length > 200 ? '...' : '') + '</div>' : '') + '<div class="observation-actions"><button class="btn btn-info btn-small" onclick="viewDetails(' + obsId + ')">ðŸ'ï¸ Voir dÃ©tails</button><button class="btn btn-warning btn-small" onclick="deleteObservation(' + obsId + ')">ðŸ—'ï¸ Supprimer</button>' + (!obs.synced ? '<button class="btn btn-secondary btn-small" onclick="syncOne(' + obsId + ')">ðŸ"„ Sync</button>' : '') + '</div></div>';
    }).join('');
}

function formatDate(dateStr) {
    try {
        return new Date(dateStr).toLocaleDateString('fr-FR');
    } catch {
        return dateStr;
    }
}

// ==================== DÃ‰TAILS ET Ã‰DITION ====================
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
    const renderComptageRows = (comptageData) => {
        if (!comptageData || comptageData.length === 0) {
            return '<tr><td><input type="text" name="comptage_horaire[]" placeholder="HH:MM"></td><td><input type="number" name="comptage_montees[]" min="0" value="0"></td><td><input type="number" name="comptage_descentes[]" min="0" value="0"></td><td><input type="number" name="comptage_attente[]" min="0" value="0"></td><td><input type="text" name="comptage_observations[]" placeholder="Observations"></td></tr>';
        }

        return comptageData.map(row => '<tr><td><input type="text" name="comptage_horaire[]" value="' + (row.horaire || '') + '" placeholder="HH:MM"></td><td><input type="number" name="comptage_montees[]" value="' + (row.montees || 0) + '" min="0"></td><td><input type="number" name="comptage_descentes[]" value="' + (row.descentes || 0) + '" min="0"></td><td><input type="number" name="comptage_attente[]" value="' + (row.attente || 0) + '" min="0"></td><td><input type="text" name="comptage_observations[]" value="' + (row.observations || '') + '" placeholder="Observations"></td></tr>').join('');
    };

    const renderCheckboxes = (name, options, selectedValues) => {
        const selected = Array.isArray(selectedValues) ? selectedValues : [];
        return options.map(opt => 
            '<div class="checkbox-item"><input type="checkbox" name="' + name + '" value="' + opt + '" ' + (selected.includes(opt) ? 'checked' : '') + '><label>' + opt + '</label></div>'
        ).join('');
    };

    const obsId = obs.id || obs._id;
    
    return '<form id="edit-form" onsubmit="handleEditSubmit(event)">' +
        
        // SECTION IDENTIFICATION
        '<div class="form-section"><h3>ðŸ"‹ IDENTIFICATION DE LA SESSION</h3>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Date *</label><input type="date" name="date" value="' + (obs.date || '') + '" required></div>' +
        '<div class="form-group"><label>Jour</label><select name="jour"><option value="">SÃ©lectionner</option>' + 
        ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(j => '<option value="' + j + '" ' + (obs.jour === j ? 'selected' : '') + '>' + j + '</option>').join('') + 
        '</select></div></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Heure dÃ©but</label><input type="time" name="heure_debut" value="' + (obs.heure_debut || '') + '"></div>' +
        '<div class="form-group"><label>Heure fin</label><input type="time" name="heure_fin" value="' + (obs.heure_fin || '') + '"></div>' +
        '<div class="form-group"><label>DurÃ©e totale (min)</label><input type="number" name="duree_totale" value="' + (obs.duree_totale || '') + '" min="0"></div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Station/TronÃ§on</label><input type="text" name="lieu_station" value="' + (obs.lieu_station || '') + '"></div>' +
        '<div class="form-group"><label>Quartier</label><input type="text" name="quartier" value="' + (obs.quartier || '') + '"></div>' +
        '</div>' +
        '<div class="form-group"><label>MÃ©tÃ©o (plusieurs choix possibles)</label><div class="checkbox-group">' +
        renderCheckboxes('meteo', ['EnsoleillÃ©', 'Nuageux', 'Pluie', 'Vent'], obs.meteo) +
        '</div></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>TempÃ©rature estimÃ©e (Â°C)</label><input type="number" name="temperature" value="' + (obs.temperature || '') + '" min="-10" max="60"></div>' +
        '<div class="form-group"><label>Type d\'observation</label><select name="type_observation">' +
        '<option value="">SÃ©lectionner</option>' +
        ['Statique (poste fixe)', 'Mobile (parcours)', 'Mixte'].map(t => '<option value="' + t + '" ' + (obs.type_observation === t ? 'selected' : '') + '>' + t + '</option>').join('') +
        '</select></div></div>' +
        '<div class="form-group"><label>Type d\'espace observÃ© (TE) - MULTICHOIX</label><div class="checkbox-group">' +
        renderCheckboxes('type_espace', [
            'TE-S: Station de tramway',
            'TE-B: Ã€ bord du tramway',
            'TE-A: Abords immÃ©diats (<50m)',
            'TE-P: Espace public connexe',
            'TE-C: Corridor/axe du tramway'
        ], obs.type_espace) +
        '</div></div>' +
        '<div class="form-group"><label>IntensitÃ© des interactions (II)</label><select name="intensite_interactions">' +
        '<option value="">SÃ©lectionner</option>' +
        ['II-1: Faible (interactions isolÃ©es)', 'II-2: ModÃ©rÃ©e (interactions rÃ©guliÃ¨res)', 'II-3: Forte (espace trÃ¨s animÃ©)', 'II-4: TrÃ¨s forte (Ã©vÃ©nement/concentration)'].map(i => 
            '<option value="' + i + '" ' + (obs.intensite_interactions === i ? 'selected' : '') + '>' + i + '</option>'
        ).join('') +
        '</select></div>' +
        '<div class="form-group"><label>Nature du patrimoine visible (NP) - MULTICHOIX</label><div class="checkbox-group">' +
        renderCheckboxes('nature_patrimoine', [
            'NP-A: Architecture coloniale',
            'NP-B: BÃ¢ti traditionnel',
            'NP-C: Architecture moderne/contemporaine',
            'NP-P: Patrimoine paysager',
            'NP-I: Patrimoine immatÃ©riel',
            'NP-M: Patrimoine mÃ©moriel'
        ], obs.nature_patrimoine) +
        '</div></div></div>' +
        
        // SECTION 1: DONNÃ‰ES QUANTITATIVES
        '<div class="form-section"><h3>ðŸ"Š SECTION 1: DONNÃ‰ES QUANTITATIVES</h3>' +
        '<h4>Flux et FrÃ©quentation</h4>' +
        '<div class="form-group"><label>Comptage des usagers</label>' +
        '<table class="counting-table"><thead><tr><th>Horaire</th><th>MontÃ©es</th><th>Descentes</th><th>Attente</th><th>Observations</th></tr></thead>' +
        '<tbody id="comptage-table-edit">' + renderComptageRows(obs.comptage_horaire || []) + '</tbody></table>' +
        '<button type="button" class="add-row-btn" onclick="addComptageRowEdit()">âž• Ajouter une ligne</button></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>FrÃ©quence des rames - Intervalle moyen (min)</label><input type="number" name="frequence_intervalle" value="' + (obs.frequence_intervalle || '') + '" min="0"></div>' +
        '<div class="form-group"><label>Nombre de rames passÃ©es</label><input type="number" name="nombre_rames" value="' + (obs.nombre_rames || '') + '" min="0"></div>' +
        '</div>' +
        '<h4>Profil des Usagers (% approximatif)</h4>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Hommes (%)</label><input type="number" name="profil_hommes" value="' + (obs.profil_hommes || '') + '" min="0" max="100"></div>' +
        '<div class="form-group"><label>Femmes (%)</label><input type="number" name="profil_femmes" value="' + (obs.profil_femmes || '') + '" min="0" max="100"></div>' +
        '<div class="form-group"><label>Enfants < 12 ans (%)</label><input type="number" name="profil_enfants" value="' + (obs.profil_enfants || '') + '" min="0" max="100"></div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Adolescents 12-18 (%)</label><input type="number" name="profil_adolescents" value="' + (obs.profil_adolescents || '') + '" min="0" max="100"></div>' +
        '<div class="form-group"><label>Adultes 18-65 (%)</label><input type="number" name="profil_adultes" value="' + (obs.profil_adultes || '') + '" min="0" max="100"></div>' +
        '<div class="form-group"><label>Personnes Ã¢gÃ©es > 65 (%)</label><input type="number" name="profil_ages" value="' + (obs.profil_ages || '') + '" min="0" max="100"></div>' +
        '</div>' +
        '<div class="form-group"><label>PMR (Personnes Ã  MobilitÃ© RÃ©duite) (%)</label><input type="number" name="profil_pmr" value="' + (obs.profil_pmr || '') + '" min="0" max="100"></div>' +
        '<h4>Comportements Observables</h4>' +
        '<div class="form-group">' +
        '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_telephone" value="oui" ' + (obs.comportement_telephone ? 'checked' : '') + '><label>Utilisation du tÃ©lÃ©phone</label><input type="text" name="comportement_telephone_detail" value="' + (obs.comportement_telephone_detail || '') + '" placeholder="% ou dÃ©tails"></div>' +
        '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_lecture" value="oui" ' + (obs.comportement_lecture ? 'checked' : '') + '><label>Lecture/journal</label><input type="text" name="comportement_lecture_detail" value="' + (obs.comportement_lecture_detail || '') + '" placeholder="% ou dÃ©tails"></div>' +
        '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_conversations" value="oui" ' + (obs.comportement_conversations ? 'checked' : '') + '><label>Conversations</label><input type="text" name="comportement_conversations_detail" value="' + (obs.comportement_conversations_detail || '') + '" placeholder="% ou dÃ©tails"></div>' +
        '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_attente_assise" value="oui" ' + (obs.comportement_attente_assise ? 'checked' : '') + '><label>Attente assise</label><input type="text" name="comportement_attente_assise_detail" value="' + (obs.comportement_attente_assise_detail || '') + '" placeholder="% ou dÃ©tails"></div>' +
        '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_attente_debout" value="oui" ' + (obs.comportement_attente_debout ? 'checked' : '') + '><label>Attente debout</label><input type="text" name="comportement_attente_debout_detail" value="' + (obs.comportement_attente_debout_detail || '') + '" placeholder="% ou dÃ©tails"></div>' +
        '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_regard_fenetre" value="oui" ' + (obs.comportement_regard_fenetre ? 'checked' : '') + '><label>Regarder Ã  travers la fenÃªtre/dans le vide</label><input type="text" name="comportement_regard_fenetre_detail" value="' + (obs.comportement_regard_fenetre_detail || '') + '" placeholder="% ou dÃ©tails"></div>' +
        '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_commerce" value="oui" ' + (obs.comportement_commerce ? 'checked' : '') + '><label>ActivitÃ©s commerciales informelles</label><input type="text" name="comportement_commerce_detail" value="' + (obs.comportement_commerce_detail || '') + '" placeholder="% ou dÃ©tails"></div>' +
        '<div class="checkbox-with-detail"><input type="checkbox" name="comportement_rassemblements" value="oui" ' + (obs.comportement_rassemblements ? 'checked' : '') + '><label>Rassemblements/groupes</label><input type="text" name="comportement_rassemblements_detail" value="' + (obs.comportement_rassemblements_detail || '') + '" placeholder="% ou dÃ©tails"></div>' +
        '</div></div>' +
        
        // SECTION 2: DONNÃ‰ES QUALITATIVES
        '<div class="form-section"><h3>ðŸŽ¨ SECTION 2: DONNÃ‰ES QUALITATIVES</h3>' +
        '<h4>Ambiances Urbaines</h4>' +
        '<div class="form-group"><label>Ambiance sonore</label><select name="ambiance_sonore">' +
        '<option value="">SÃ©lectionner</option>' +
        ['Silencieux', 'Calme', 'AnimÃ©', 'Bruyant', 'TrÃ¨s bruyant'].map(a => '<option value="' + a + '" ' + (obs.ambiance_sonore === a ? 'selected' : '') + '>' + a + '</option>').join('') +
        '</select></div>' +
        '<div class="form-group"><label>Sons dominants</label><textarea name="sons_dominants">' + (obs.sons_dominants || '') + '</textarea></div>' +
        '<div class="form-group"><label>Ambiance visuelle</label><textarea name="ambiance_visuelle">' + (obs.ambiance_visuelle || '') + '</textarea></div>' +
        '<div class="form-group"><label>Ambiance olfactive</label><textarea name="ambiance_olfactive">' + (obs.ambiance_olfactive || '') + '</textarea></div>' +
        '<div class="form-group"><label>AtmosphÃ¨re gÃ©nÃ©rale</label><select name="atmosphere_generale">' +
        '<option value="">SÃ©lectionner</option>' +
        ['ApaisÃ©e', 'Tendue', 'Conviviale', 'Anonyme', 'Festive'].map(a => '<option value="' + a + '" ' + (obs.atmosphere_generale === a ? 'selected' : '') + '>' + a + '</option>').join('') +
        '</select></div>' +
        '<h4>Interactions Sociales ObservÃ©es</h4>' +
        '<div class="form-group"><label>Nature des interactions</label><textarea name="nature_interactions">' + (obs.nature_interactions || '') + '</textarea></div>' +
        '<div class="form-group"><label>Groupes sociaux identifiÃ©s</label><textarea name="groupes_sociaux_identifies">' + (obs.groupes_sociaux_identifies || '') + '</textarea></div>' +
        '<div class="form-group"><label>Pratiques sociales remarquables</label><textarea name="pratiques_sociales">' + (obs.pratiques_sociales || '') + '</textarea></div>' +
        '<h4>Perceptions et Discours CaptÃ©s</h4>' +
        '<div class="form-group"><label>Conversations entendues (verbatim)</label><textarea name="conversations_verbatim">' + (obs.conversations_verbatim || '') + '</textarea></div>' +
        '<div class="form-group"><label>Langue(s) utilisÃ©e(s)</label><div class="checkbox-group">' +
        renderCheckboxes('langues_utilisees', ['Arabe dialectal', 'FranÃ§ais', 'Tamazight', 'Mixte'], obs.langues_utilisees) +
        '</div></div>' +
        '<div class="form-group"><label>ThÃ©matiques Ã©voquÃ©es</label><textarea name="thematiques_evoquees">' + (obs.thematiques_evoquees || '') + '</textarea></div>' +
        '<h4>Patrimoine et MÃ©moire</h4>' +
        '<div class="form-group"><label>Ã‰lÃ©ments patrimoniaux visibles</label><textarea name="elements_patrimoniaux">' + (obs.elements_patrimoniaux || '') + '</textarea></div>' +
        '<div class="form-group"><label>Ã‰tat de conservation</label><select name="etat_conservation">' +
        '<option value="">SÃ©lectionner</option>' +
        ['Excellent', 'Bon', 'Moyen', 'DÃ©gradÃ©', 'Ruine'].map(e => '<option value="' + e + '" ' + (obs.etat_conservation === e ? 'selected' : '') + '>' + e + '</option>').join('') +
        '</select></div>' +
        '<div class="form-group"><label>Perception du patrimoine par les usagers</label><select name="perception_patrimoine">' +
        '<option value="">SÃ©lectionner</option>' +
        ['ValorisÃ©', 'IgnorÃ©', 'DÃ©tournÃ©', 'AppropriÃ©', 'RejetÃ©'].map(p => '<option value="' + p + '" ' + (obs.perception_patrimoine === p ? 'selected' : '') + '>' + p + '</option>').join('') +
        '</select></div></div>' +
        
        // SECTION 4: RÃ‰FLEXIONS POST-OBSERVATION
        '<div class="form-section"><h3>ðŸ'­ SECTION 4: RÃ‰FLEXIONS POST-OBSERVATION</h3>' +
        '<h4>Analyse Ã  Chaud</h4>' +
        '<div class="form-group"><label>Impressions gÃ©nÃ©rales</label><textarea name="impressions_generales">' + (obs.impressions_generales || '') + '</textarea></div>' +
        '<div class="form-group"><label>Ã‰lÃ©ments surprenants/inattendus</label><textarea name="elements_surprenants">' + (obs.elements_surprenants || '') + '</textarea></div>' +
        '<div class="form-group"><label>Tensions ou conflits d\'usage observÃ©s</label><textarea name="tensions_conflits">' + (obs.tensions_conflits || '') + '</textarea></div>' +
        '<div class="form-group"><label>Appropriations remarquables de l\'espace</label><textarea name="appropriations_espace">' + (obs.appropriations_espace || '') + '</textarea></div>' +
        '<h4>HypothÃ¨ses Ã‰mergentes</h4>' +
        '<div class="form-group"><label>HypothÃ¨se 1</label><textarea name="hypothese_1">' + (obs.hypothese_1 || '') + '</textarea></div>' +
        '<div class="form-group"><label>HypothÃ¨se 2</label><textarea name="hypothese_2">' + (obs.hypothese_2 || '') + '</textarea></div>' +
        '<div class="form-group"><label>HypothÃ¨se 3</label><textarea name="hypothese_3">' + (obs.hypothese_3 || '') + '</textarea></div></div>' +
        
        // SECTION 5: NOTES COMPLÃ‰MENTAIRES
        '<div class="form-section"><h3>ðŸ" SECTION 5: NOTES COMPLÃ‰MENTAIRES</h3>' +
        '<div class="form-group"><label>Notes supplÃ©mentaires</label><textarea name="notes_complementaires" style="min-height: 150px;">' + (obs.notes_complementaires || '') + '</textarea></div>' +
        '<div class="form-group"><label>Pistes pour la prochaine observation</label><textarea name="pistes_prochaine">' + (obs.pistes_prochaine || '') + '</textarea></div>' +
        '<div class="form-group"><label>Questions mÃ©thodologiques</label><textarea name="questions_methodologiques">' + (obs.questions_methodologiques || '') + '</textarea></div></div>' +
        
        '<div style="display: flex; gap: 10px; margin-top: 20px;">' +
        '<button type="submit" class="btn btn-primary" style="flex: 1; padding: 18px; font-size: 1.2em;">ðŸ'¾ Enregistrer</button>' +
        '<button type="button" class="btn btn-warning" onclick="exportOne(' + obsId + ')" style="flex: 1; padding: 18px; font-size: 1.2em;">ðŸ"¥ Exporter</button>' +
        '</div></form>';
            
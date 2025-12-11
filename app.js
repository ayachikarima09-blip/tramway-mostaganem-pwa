const API_BASE = 'https://tramway-pwa-backend.onrender.com';
const DB_NAME = 'tramway-observations';
const STORE_NAME = 'observations';
const DB_VERSION = 1;

let db;
let allObservations = [];
let currentEditId = null;

function normalizeObservation(obs) {
    if (obs._id && !obs.id) {
        obs.id = typeof obs._id === 'object' ? obs._id.toString() : obs._id;
    } else if (obs.id && !obs._id) {
        obs._id = obs.id;
    }
    if (!obs.created_at) {
        obs.created_at = new Date().toISOString();
    }
    if (!obs.updated_at) {
        obs.updated_at = obs.created_at;
    }
    if (!obs.version) {
        obs.version = 1;
    }
    return obs;
}

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

function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 15px; background: ' + 
        (type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3') + 
        '; color: white; border-radius: 4px; z-index: 9999; min-width: 250px;';
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
}

function openNewObservationModal() {
    const modal = document.getElementById('new-observation-modal');
    if (modal) {
        currentEditId = null;
        const form = document.getElementById('observation-form');
        if (form) form.reset();
        modal.style.display = 'block';
    }
}

function closeNewObservationModal() {
    const modal = document.getElementById('new-observation-modal');
    if (modal) modal.style.display = 'none';
}

function collectFormData() {
    const formElements = {
        date: document.querySelector('[name="date"]')?.value || '',
        jour: document.querySelector('[name="jour"]')?.value || '',
        heure_debut: document.querySelector('[name="heure_debut"]')?.value || '',
        heure_fin: document.querySelector('[name="heure_fin"]')?.value || '',
        duree_totale: document.querySelector('[name="duree_totale"]')?.value || '',
        station: document.querySelector('[name="station"]')?.value || '',
        quartier: document.querySelector('[name="quartier"]')?.value || '',
        temperature: document.querySelector('[name="temperature"]')?.value || '',
        type_observation: document.querySelector('[name="type_observation"]')?.value || '',
        intensite: document.querySelector('[name="intensite"]')?.value || '',
        meteo: Array.from(document.querySelectorAll('[name="meteo"]:checked')).map(el => el.value),
        type_espace: Array.from(document.querySelectorAll('[name="type_espace"]:checked')).map(el => el.value),
        patrimoine: Array.from(document.querySelectorAll('[name="patrimoine"]:checked')).map(el => el.value),
        frequence_rames: document.querySelector('[name="frequence_rames"]')?.value || '',
        nombre_rames: document.querySelector('[name="nombre_rames"]')?.value || '',
        hommes_pct: document.querySelector('[name="hommes_pct"]')?.value || '',
        femmes_pct: document.querySelector('[name="femmes_pct"]')?.value || '',
        enfants_pct: document.querySelector('[name="enfants_pct"]')?.value || '',
        adolescents_pct: document.querySelector('[name="adolescents_pct"]')?.value || '',
        adultes_pct: document.querySelector('[name="adultes_pct"]')?.value || '',
        seniors_pct: document.querySelector('[name="seniors_pct"]')?.value || '',
        pmr_pct: document.querySelector('[name="pmr_pct"]')?.value || '',
        comportements: Array.from(document.querySelectorAll('[name="comportements"]:checked')).map(el => el.value),
        ambiance_sonore: document.querySelector('[name="ambiance_sonore"]')?.value || '',
        sons_dominants: document.querySelector('[name="sons_dominants"]')?.value || '',
        ambiance_visuelle: document.querySelector('[name="ambiance_visuelle"]')?.value || '',
        ambiance_olfactive: document.querySelector('[name="ambiance_olfactive"]')?.value || '',
        atmosphere_generale: document.querySelector('[name="atmosphere_generale"]')?.value || '',
        nature_interactions: document.querySelector('[name="nature_interactions"]')?.value || '',
        groupes_sociaux: document.querySelector('[name="groupes_sociaux"]')?.value || '',
        pratiques_sociales: document.querySelector('[name="pratiques_sociales"]')?.value || '',
        conversations_verbatim: document.querySelector('[name="conversations_verbatim"]')?.value || '',
        langue: document.querySelector('[name="langue"]')?.value || '',
        thematiques: document.querySelector('[name="thematiques"]')?.value || '',
        elements_patrimoniaux: document.querySelector('[name="elements_patrimoniaux"]')?.value || '',
        etat_conservation: document.querySelector('[name="etat_conservation"]')?.value || '',
        perception_patrimoine: document.querySelector('[name="perception_patrimoine"]')?.value || '',
        impressions_generales: document.querySelector('[name="impressions_generales"]')?.value || '',
        elements_surprenants: document.querySelector('[name="elements_surprenants"]')?.value || '',
        tensions_conflits: document.querySelector('[name="tensions_conflits"]')?.value || '',
        appropriations: document.querySelector('[name="appropriations"]')?.value || '',
        hypothese_1: document.querySelector('[name="hypothese_1"]')?.value || '',
        hypothese_2: document.querySelector('[name="hypothese_2"]')?.value || '',
        hypothese_3: document.querySelector('[name="hypothese_3"]')?.value || '',
        notes_supplementaires: document.querySelector('[name="notes_supplementaires"]')?.value || '',
        pistes_prochaines: document.querySelector('[name="pistes_prochaines"]')?.value || '',
        questions_methodologiques: document.querySelector('[name="questions_methodologiques"]')?.value || '',
        comptages: collectComptageData(),
        created_at: currentEditId ? allObservations.find(o => o.id === currentEditId)?.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: currentEditId ? (allObservations.find(o => o.id === currentEditId)?.version || 0) + 1 : 1
    };

    formElements.id = currentEditId || new Date().getTime().toString();
    formElements._id = formElements.id;
    return normalizeObservation(formElements);
}

function collectComptageData() {
    const comptages = [];
    const rows = document.querySelectorAll('#comptage-table tbody tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('input, textarea');
        if (cells.length >= 4) {
            comptages.push({
                horaire: cells[0]?.value || '',
                montees: cells[1]?.value || '',
                descentes: cells[2]?.value || '',
                attente: cells[3]?.value || '',
                observations: cells[4]?.value || ''
            });
        }
    });
    return comptages;
}

async function handleObservationSubmit(event) {
    event.preventDefault();
    const observation = collectFormData();
    
    try {
        let isOnline = await checkConnection();
        
        if (isOnline) {
            const endpoint = currentEditId 
                ? `${API_BASE}/api/observations/${currentEditId}`
                : `${API_BASE}/api/observations`;
            const method = currentEditId ? 'PUT' : 'POST';
            
            const response = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(observation)
            });
            
            if (response.ok) {
                const result = await response.json();
                observation.id = result.id || result._id.toString();
                observation._id = observation.id;
                observation.version = result.version || observation.version;
                
                await saveObservation(observation);
                showMessage(currentEditId ? '✅ Observation modifiée!' : '✅ Observation créée!', 'success');
                currentEditId = null;
                closeNewObservationModal();
                await loadObservations();
            } else {
                showMessage('❌ Erreur lors de l\'enregistrement', 'error');
            }
        } else {
            await saveObservation(observation);
            showMessage('📴 Sauvegardé en local', 'warning');
            currentEditId = null;
            closeNewObservationModal();
            await loadObservations();
        }
    } catch (error) {
        console.error('Error:', error);
        await saveObservation(observation);
        showMessage('⚠️ Observation sauvegardée localement', 'warning');
        currentEditId = null;
        closeNewObservationModal();
        await loadObservations();
    }
}

function showObservationDetail(id) {
    const obs = allObservations.find(o => o.id === id);
    if (!obs) return;
    
    const modal = document.getElementById('detail-modal');
    const detailContent = document.getElementById('detail-content');
    
    if (!detailContent) return;
    
    detailContent.innerHTML = `
        <div style="max-height: 80vh; overflow-y: auto; padding: 20px;">
            <h2>${obs.station || 'Sans station'} - ${new Date(obs.date).toLocaleDateString('fr-FR')}</h2>
            <p><strong>Jour:</strong> ${obs.jour || 'N/A'}</p>
            <p><strong>Horaires:</strong> ${obs.heure_debut || '-'} à ${obs.heure_fin || '-'}</p>
            <p><strong>Température:</strong> ${obs.temperature || 'N/A'}°C</p>
            <p><strong>Créée le:</strong> ${new Date(obs.created_at).toLocaleString('fr-FR')}</p>
            <p><strong>Modifiée le:</strong> ${new Date(obs.updated_at).toLocaleString('fr-FR')}</p>
            <p><strong>Version:</strong> ${obs.version}</p>
            <div style="margin-top: 20px;">
                <button onclick="editObservation('${obs.id}')" style="background: #2196F3; color: white; padding: 10px 20px; border: none; cursor: pointer; margin-right: 10px;">✏️ Modifier</button>
                <button onclick="deleteObservation('${obs.id}')" style="background: #f44336; color: white; padding: 10px 20px; border: none; cursor: pointer; margin-right: 10px;">🗑️ Supprimer</button>
                <button onclick="closeDetailModal()" style="background: #757575; color: white; padding: 10px 20px; border: none; cursor: pointer;">Fermer</button>
            </div>
        </div>
    `;
    
    if (modal) modal.style.display = 'flex';
}

function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.style.display = 'none';
}

function editObservation(id) {
    const obs = allObservations.find(o => o.id === id);
    if (!obs) return;
    
    currentEditId = id;
    closeDetailModal();
    
    document.querySelector('[name="date"]').value = obs.date || '';
    document.querySelector('[name="jour"]').value = obs.jour || '';
    document.querySelector('[name="heure_debut"]').value = obs.heure_debut || '';
    document.querySelector('[name="heure_fin"]').value = obs.heure_fin || '';
    document.querySelector('[name="station"]').value = obs.station || '';
    document.querySelector('[name="quartier"]').value = obs.quartier || '';
    document.querySelector('[name="temperature"]').value = obs.temperature || '';
    document.querySelector('[name="type_observation"]').value = obs.type_observation || '';
    document.querySelector('[name="intensite"]').value = obs.intensite || '';
    
    document.querySelectorAll('[name="meteo"]').forEach(el => {
        el.checked = (obs.meteo || []).includes(el.value);
    });
    
    document.querySelectorAll('[name="type_espace"]').forEach(el => {
        el.checked = (obs.type_espace || []).includes(el.value);
    });
    
    document.querySelectorAll('[name="patrimoine"]').forEach(el => {
        el.checked = (obs.patrimoine || []).includes(el.value);
    });
    
    document.querySelectorAll('[name="comportements"]').forEach(el => {
        el.checked = (obs.comportements || []).includes(el.value);
    });
    
    document.querySelector('[name="impressions_generales"]').value = obs.impressions_generales || '';
    document.querySelector('[name="notes_supplementaires"]').value = obs.notes_supplementaires || '';
    
    const modal = document.getElementById('new-observation-modal');
    if (modal) modal.style.display = 'block';
}

async function deleteObservation(id) {
    if (!confirm('Êtes-vous sûr?')) return;
    
    try {
        let isOnline = await checkConnection();
        
        if (isOnline) {
            const response = await fetch(`${API_BASE}/api/observations/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                await deleteLocal(id);
                showMessage('✅ Observation supprimée!', 'success');
                closeDetailModal();
                await loadObservations();
            } else {
                showMessage('❌ Erreur', 'error');
            }
        } else {
            await deleteLocal(id);
            showMessage('📴 Supprimée localement', 'warning');
            closeDetailModal();
            await loadObservations();
        }
    } catch (error) {
        await deleteLocal(id);
        showMessage('⚠️ Supprimée localement', 'warning');
        closeDetailModal();
        await loadObservations();
    }
}

async function loadObservations() {
    try {
        let isOnline = await checkConnection();
        
        if (isOnline) {
            const response = await fetch(`${API_BASE}/api/observations`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                allObservations = await response.json();
                allObservations = allObservations.map(normalizeObservation);
                
                for (const obs of allObservations) {
                    await saveObservation(obs);
                }
            }
        } else {
            allObservations = await getAllLocal();
        }
        
        displayObservations();
    } catch (error) {
        allObservations = await getAllLocal();
        displayObservations();
    }
}

function displayObservations() {
    const tbody = document.getElementById('observations-tbody');
    if (!tbody) return;
    
    if (allObservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">Aucune observation</td></tr>';
        return;
    }
    
    tbody.innerHTML = allObservations.map(obs => `
        <tr style="cursor: pointer;" onclick="showObservationDetail('${obs.id}')">
            <td>${obs.date || '-'}</td>
            <td>${obs.station || 'Sans nom'}</td>
            <td>${obs.jour || '-'}</td>
            <td>${obs.temperature || '-'}°C</td>
            <td>${new Date(obs.created_at).toLocaleDateString('fr-FR')}</td>
            <td>
                <button onclick="event.stopPropagation(); editObservation('${obs.id}')" style="background: #2196F3; color: white; padding: 5px 10px; border: none; cursor: pointer; margin-right: 5px;">✏️</button>
                <button onclick="event.stopPropagation(); deleteObservation('${obs.id}')" style="background: #f44336; color: white; padding: 5px 10px; border: none; cursor: pointer;">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function addComptageRow() {
    const tbody = document.querySelector('#comptage-table tbody');
    if (!tbody) return;
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="time" style="width: 100%; padding: 5px;"></td>
        <td><input type="number" style="width: 100%; padding: 5px;"></td>
        <td><input type="number" style="width: 100%; padding: 5px;"></td>
        <td><input type="number" style="width: 100%; padding: 5px;"></td>
        <td><textarea style="width: 100%; padding: 5px;"></textarea></td>
    `;
    tbody.appendChild(row);
}

async function syncData() {
    const isOnline = await checkConnection();
    if (!isOnline) {
        showMessage('📴 Hors ligne', 'warning');
        return;
    }
    
    const localObs = await getAllLocal();
    for (const obs of localObs) {
        await fetch(`${API_BASE}/api/observations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(obs)
        }).catch(() => {});
    }
    
    showMessage('✅ Synchronisé!', 'success');
    await loadObservations();
}

function importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
        try {
            const file = e.target.files[0];
            const text = await file.text();
            const data = JSON.parse(text);
            const observations = Array.isArray(data) ? data : [data];
            
            for (const obs of observations) {
                await saveObservation(normalizeObservation(obs));
            }
            showMessage(`✅ ${observations.length} importée(s)!`, 'success');
            await loadObservations();
        } catch (error) {
            showMessage('❌ Erreur import', 'error');
        }
    };
    input.click();
}

async function exportAll() {
    const observations = await getAllLocal();
    const json = JSON.stringify(observations, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `observations-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showMessage('✅ Export!', 'success');
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await loadObservations();
        await checkConnection();
        
        const form = document.getElementById('observation-form');
        if (form) {
            form.addEventListener('submit', handleObservationSubmit);
        }
    } catch (error) {
        console.error('Init error:', error);
        showMessage('⚠️ Erreur init', 'error');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeNewObservationModal();
        closeDetailModal();
    }
});

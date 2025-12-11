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

// ==================== AFFICHER MESSAGES ====================
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// ==================== NOUVELLE OBSERVATION ====================
function openNewObservationModal() {
    const modal = document.getElementById('new-observation-modal');
    const form = document.getElementById('observation-form');

    currentEditId = null;
    form.reset();
    document.querySelector('#observation-form input[name="date"]').value = new Date().toISOString().split('T')[0];

    const tbody = document.getElementById('comptage-table-new');
    if (tbody) {
        tbody.innerHTML = '';
    }

    modal.style.display = 'flex';
}

function closeNewObservationModal() {
    const modal = document.getElementById('new-observation-modal');
    modal.style.display = 'none';
}

// ==================== SOUMETTRE OBSERVATION ====================
async function handleObservationSubmit(event) {
    event.preventDefault();

    const form = document.getElementById('observation-form');
    const formData = new FormData(form);
    
    const observation = {
        lieu_station: formData.get('lieu_station') || '',
        date: formData.get('date') || new Date().toISOString().split('T')[0],
        temperature: formData.get('temperature') || '',
        humidite: formData.get('humidite') || '',
        notes: formData.get('notes') || '',
        created_at: currentEditId ? allObservations.find(o => o.id === currentEditId)?.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: currentEditId ? (allObservations.find(o => o.id === currentEditId)?.version || 1) + 1 : 1
    };

    observation.id = currentEditId || new Date().getTime().toString();
    observation._id = observation.id;

    observation = normalizeObservation(observation);

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
                form.reset();
                closeNewObservationModal();
                await loadObservations();
            } else {
                showMessage('❌ Erreur lors de l\'enregistrement', 'error');
            }
        } else {
            await saveObservation(observation);
            showMessage('📴 Sauvegardé en local (sync en ligne)', 'warning');
            currentEditId = null;
            form.reset();
            closeNewObservationModal();
            await loadObservations();
        }
    } catch (error) {
        console.error('Error:', error);
        await saveObservation(observation);
        showMessage('⚠️ Erreur, observation sauvegardée localement', 'warning');
        currentEditId = null;
        form.reset();
        closeNewObservationModal();
        await loadObservations();
    }
}

// ==================== AFFICHER DÉTAIL OBSERVATION ====================
function showObservationDetail(id) {
    const obs = allObservations.find(o => o.id === id);
    if (!obs) return;

    const modal = document.getElementById('detail-modal');
    const detailContent = document.getElementById('detail-content');

    detailContent.innerHTML = `
        <div class="detail-header">
            <h2>${obs.lieu_station || 'Sans nom'}</h2>
            <span class="detail-date">${new Date(obs.date).toLocaleDateString('fr-FR')}</span>
        </div>
        <div class="detail-body">
            <p><strong>Température:</strong> ${obs.temperature || 'N/A'}</p>
            <p><strong>Humidité:</strong> ${obs.humidite || 'N/A'}%</p>
            <p><strong>Notes:</strong> ${obs.notes || 'Aucune note'}</p>
            <p><strong>Créée le:</strong> ${new Date(obs.created_at).toLocaleString('fr-FR')}</p>
            <p><strong>Modifiée le:</strong> ${new Date(obs.updated_at).toLocaleString('fr-FR')}</p>
            <p><strong>Version:</strong> ${obs.version}</p>
        </div>
        <div class="detail-actions">
            <button class="btn btn-primary" onclick="editObservation('${id}')">✏️ Modifier</button>
            <button class="btn btn-danger" onclick="deleteObservation('${id}')">🗑️ Supprimer</button>
            <button class="btn btn-secondary" onclick="closeDetailModal()">Fermer</button>
        </div>
    `;

    modal.style.display = 'flex';
}

function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    modal.style.display = 'none';
}

// ==================== MODIFIER OBSERVATION ====================
function editObservation(id) {
    const obs = allObservations.find(o => o.id === id);
    if (!obs) return;

    currentEditId = id;
    closeDetailModal();

    const form = document.getElementById('observation-form');
    form.querySelector('input[name="lieu_station"]').value = obs.lieu_station || '';
    form.querySelector('input[name="date"]').value = obs.date || '';
    form.querySelector('input[name="temperature"]').value = obs.temperature || '';
    form.querySelector('input[name="humidite"]').value = obs.humidite || '';
    form.querySelector('textarea[name="notes"]').value = obs.notes || '';

    const modal = document.getElementById('new-observation-modal');
    modal.style.display = 'flex';
}

// ==================== SUPPRIMER OBSERVATION ====================
async function deleteObservation(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette observation?')) {
        return;
    }

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
                showMessage('❌ Erreur lors de la suppression', 'error');
            }
        } else {
            await deleteLocal(id);
            showMessage('📴 Supprimée localement (sync en ligne)', 'warning');
            closeDetailModal();
            await loadObservations();
        }
    } catch (error) {
        console.error('Delete error:', error);
        await deleteLocal(id);
        showMessage('⚠️ Supprimée localement', 'warning');
        closeDetailModal();
        await loadObservations();
    }
}

// ==================== CHARGER OBSERVATIONS ====================
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

                // Sauvegarder localement
                for (const obs of allObservations) {
                    await saveObservation(obs);
                }
            }
        } else {
            allObservations = await getAllLocal();
        }

        displayObservations();
    } catch (error) {
        console.error('Load error:', error);
        allObservations = await getAllLocal();
        displayObservations();
    }
}

function displayObservations() {
    const tbody = document.getElementById('observations-list');
    if (!tbody) return;

    if (allObservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Aucune observation</td></tr>';
        return;
    }

    tbody.innerHTML = allObservations.map(obs => `
        <tr onclick="showObservationDetail('${obs.id}')">
            <td>${obs.lieu_station || 'Sans nom'}</td>
            <td>${new Date(obs.date).toLocaleDateString('fr-FR')}</td>
            <td>${obs.temperature || '-'}°</td>
            <td>${obs.humidite || '-'}%</td>
            <td>
                <button class="btn btn-sm" onclick="event.stopPropagation(); editObservation('${obs.id}')">✏️</button>
                <button class="btn btn-sm" onclick="event.stopPropagation(); deleteObservation('${obs.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await loadObservations();
        await checkConnection();
    } catch (error) {
        console.error('Init error:', error);
        showMessage('⚠️ Erreur lors de l\'initialisation', 'error');
    }
});

// ==================== FERMER LES MODALES AVEC ESC ====================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeNewObservationModal();
        closeDetailModal();
    }
});

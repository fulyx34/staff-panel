// État global de l'application
let currentUser = null;
let sanctions = [];
let tasks = [];
let announcements = [];
let absences = [];
let users = [];
let allUsernames = [];
let selectedUsers = [];
let selectedStaffMembers = []; // Pour le multi-select des sanctions

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    initEventListeners();
});

// Vérifier si l'utilisateur est déjà connecté
async function checkSession() {
    try {
        const response = await fetch('/api/session');
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showDashboard();
            await loadAllData();
        } else {
            showLoginPage();
        }
    } catch (error) {
        showLoginPage();
    }
}

// Initialiser les écouteurs d'événements
function initEventListeners() {
    // Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Modals
    setupModalListeners('sanction');
    setupModalListeners('task');
    setupModalListeners('announcement');
    setupModalListeners('absence');
    setupModalListeners('user');
    setupModalListeners('password');

    // Forms
    document.getElementById('sanction-form').addEventListener('submit', handleAddSanction);
    document.getElementById('task-form').addEventListener('submit', handleAddTask);
    document.getElementById('announcement-form').addEventListener('submit', handleAddAnnouncement);
    document.getElementById('absence-form').addEventListener('submit', handleAddAbsence);
    document.getElementById('user-form')?.addEventListener('submit', handleAddUser);
    document.getElementById('password-form')?.addEventListener('submit', handleChangePassword);

    // Filtres
    document.getElementById('sanction-search')?.addEventListener('input', filterSanctions);
    document.getElementById('sanction-type-filter')?.addEventListener('change', filterSanctions);
    document.getElementById('task-date-filter')?.addEventListener('change', filterTasks);
    document.getElementById('task-status-filter')?.addEventListener('change', filterTasks);
}

// Gestion du login
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            errorDiv.textContent = '';
            showDashboard();
            await loadAllData();
        } else {
            errorDiv.textContent = 'Identifiants incorrects';
        }
    } catch (error) {
        errorDiv.textContent = 'Erreur de connexion';
    }
}

// Déconnexion
async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        showLoginPage();
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
    }
}

// Afficher les pages
function showLoginPage() {
    document.getElementById('login-page').classList.add('active');
    document.getElementById('dashboard-page').classList.remove('active');
}

function showDashboard() {
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('dashboard-page').classList.add('active');
    document.getElementById('user-info').textContent = `${currentUser.username} (${currentUser.role})`;
    updateUIBasedOnPermissions();
}

// Mettre à jour l'interface en fonction des permissions
function updateUIBasedOnPermissions() {
    console.log('Permissions:', currentUser.permissions);

    // Masquer les boutons si pas de permissions
    const sanctionBtn = document.getElementById('add-sanction-btn');
    if (sanctionBtn) {
        sanctionBtn.style.display = currentUser.permissions.canManageSanctions ? 'block' : 'none';
        console.log('Bouton sanction:', sanctionBtn.style.display, 'Permission:', currentUser.permissions.canManageSanctions);
    } else {
        console.error('Bouton sanction non trouvé !');
    }

    const taskBtn = document.getElementById('add-task-btn');
    if (taskBtn) {
        taskBtn.style.display = currentUser.permissions.canManageTasks ? 'block' : 'none';
    }

    const announcementBtn = document.getElementById('add-announcement-btn');
    if (announcementBtn) {
        announcementBtn.style.display = currentUser.permissions.canManageAnnouncements ? 'block' : 'none';
    }

    const absenceBtn = document.getElementById('add-absence-btn');
    if (absenceBtn) {
        absenceBtn.style.display = 'block'; // Tout le monde peut poser une absence
    }

    // Afficher l'onglet utilisateurs si l'utilisateur a la permission
    const usersTabBtn = document.getElementById('users-tab-btn');
    if (usersTabBtn) {
        usersTabBtn.style.display = currentUser.permissions.canManageUsers ? 'block' : 'none';
    }
}

// Changer d'onglet
function switchTab(tabName) {
    // Mettre à jour les boutons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Mettre à jour le contenu
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Gestion des modals
function setupModalListeners(type) {
    const btn = document.getElementById(`add-${type}-btn`);
    const modal = document.getElementById(`${type}-modal`);
    const close = modal?.querySelector('.close');

    btn?.addEventListener('click', () => {
        modal.classList.add('active');
    });

    close?.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

// Charger toutes les données
async function loadAllData() {
    await Promise.all([
        loadSanctions(),
        loadTasks(),
        loadAnnouncements(),
        loadAbsences(),
        loadUsersList()
    ]);

    // Charger les utilisateurs si l'utilisateur a la permission
    if (currentUser.permissions.canManageUsers) {
        await loadUsers();
    }

    updateDashboard();
}

// Mettre à jour le dropdown des membres du staff pour les sanctions (multi-select)
function updateStaffMembersDropdown() {
    const optionsContainer = document.getElementById('staff-member-options');
    if (!optionsContainer) return;

    optionsContainer.innerHTML = '';

    allUsernames.forEach(username => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'multi-select-option';
        optionDiv.innerHTML = `
            <input type="checkbox" id="staff-${username}" value="${username}">
            <label for="staff-${username}">${username}</label>
        `;

        optionDiv.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!selectedStaffMembers.includes(username)) {
                    selectedStaffMembers.push(username);
                }
            } else {
                selectedStaffMembers = selectedStaffMembers.filter(u => u !== username);
            }
            updateStaffMembersDisplay();
        });

        optionsContainer.appendChild(optionDiv);
    });
}

// Mettre à jour l'affichage des membres du staff sélectionnés
function updateStaffMembersDisplay() {
    const display = document.getElementById('staff-member-display');
    const hiddenInput = document.getElementById('staff-member');

    if (!display) return;

    if (selectedStaffMembers.length === 0) {
        display.innerHTML = '<span class="placeholder">Sélectionner un ou plusieurs membres du staff...</span>';
        hiddenInput.value = '';
    } else {
        const tags = selectedStaffMembers.map(username => `
            <span class="selected-tag">
                ${username}
                <span class="remove-tag" onclick="removeStaffMember('${username}')">&times;</span>
            </span>
        `).join('');
        display.innerHTML = tags;
        hiddenInput.value = selectedStaffMembers.join(',');
    }
}

// Retirer un membre du staff de la sélection
function removeStaffMember(username) {
    selectedStaffMembers = selectedStaffMembers.filter(u => u !== username);

    // Décocher la checkbox correspondante
    const checkbox = document.getElementById(`staff-${username}`);
    if (checkbox) checkbox.checked = false;

    updateStaffMembersDisplay();
}

// Initialiser le multi-select pour les sanctions
function setupStaffMembersMultiSelect() {
    const display = document.getElementById('staff-member-display');
    const dropdown = document.getElementById('staff-member-dropdown');
    const searchInput = document.getElementById('staff-member-search');

    if (!display || !dropdown) return;

    // Toggle dropdown au clic sur le display
    display.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });

    // Recherche dans les options
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const options = document.querySelectorAll('#staff-member-options .multi-select-option');

            options.forEach(option => {
                const label = option.querySelector('label').textContent.toLowerCase();
                option.style.display = label.includes(searchTerm) ? 'flex' : 'none';
            });
        });
    }

    // Fermer le dropdown en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.multi-select-wrapper')) {
            dropdown.classList.remove('active');
        }
    });
}

// Charger les sanctions
async function loadSanctions() {
    try {
        const response = await fetch('/api/sanctions');
        sanctions = await response.json();
        displaySanctions(sanctions);
    } catch (error) {
        console.error('Erreur chargement sanctions:', error);
    }
}

// Afficher les sanctions
function displaySanctions(sanctionsToDisplay) {
    const container = document.getElementById('sanctions-list');

    if (sanctionsToDisplay.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucune sanction enregistrée</div>';
        return;
    }

    container.innerHTML = sanctionsToDisplay.map(sanction => `
        <div class="card">
            <div class="card-header">
                <div>
                    <span class="card-title">${sanction.staffMember}</span>
                    <span class="badge badge-${sanction.type.replace('_', '-')}">${formatSanctionType(sanction.type)}</span>
                </div>
                ${currentUser.permissions.canManageSanctions ? `
                    <div class="card-actions">
                        <button class="btn btn-danger" onclick="deleteSanction(${sanction.id})">Supprimer</button>
                    </div>
                ` : ''}
            </div>
            <div class="card-body">
                <p><strong>Raison:</strong> ${sanction.reason}</p>
                ${sanction.notes ? `<p><strong>Notes:</strong> ${sanction.notes}</p>` : ''}
            </div>
            <div class="card-info">
                <div class="card-info-item">
                    <strong>Auteur</strong>
                    <span>${sanction.author || 'N/A'}</span>
                </div>
                <div class="card-info-item">
                    <strong>Date</strong>
                    <span>${formatDate(sanction.date)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Ajouter une sanction
async function handleAddSanction(e) {
    e.preventDefault();

    // Vérifier qu'au moins un membre du staff est sélectionné
    if (selectedStaffMembers.length === 0) {
        alert('Veuillez sélectionner au moins un membre du staff');
        return;
    }

    const sanctionData = {
        type: document.getElementById('sanction-type').value,
        reason: document.getElementById('sanction-reason').value,
        notes: document.getElementById('sanction-notes').value
    };

    try {
        // Créer une sanction pour chaque membre du staff sélectionné
        const promises = selectedStaffMembers.map(staffMember => {
            return fetch('/api/sanctions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...sanctionData,
                    staffMember: staffMember
                })
            });
        });

        const responses = await Promise.all(promises);

        // Vérifier que toutes les requêtes ont réussi
        const allSuccess = responses.every(r => r.ok);

        if (allSuccess) {
            document.getElementById('sanction-modal').classList.remove('active');
            document.getElementById('sanction-form').reset();
            selectedStaffMembers = [];
            updateStaffMembersDisplay();
            // Décocher toutes les checkboxes
            document.querySelectorAll('#staff-member-options input[type="checkbox"]').forEach(cb => cb.checked = false);
            await loadSanctions();
            updateDashboard();
        } else {
            alert('Erreur lors de l\'ajout de certaines sanctions');
        }
    } catch (error) {
        console.error('Erreur ajout sanction:', error);
        alert('Erreur lors de l\'ajout de la sanction');
    }
}

// Supprimer une sanction
async function deleteSanction(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette sanction ?')) return;

    try {
        await fetch(`/api/sanctions/${id}`, { method: 'DELETE' });
        await loadSanctions();
        updateDashboard();
    } catch (error) {
        console.error('Erreur suppression sanction:', error);
    }
}

// Filtrer les sanctions
function filterSanctions() {
    const search = document.getElementById('sanction-search').value.toLowerCase();
    const typeFilter = document.getElementById('sanction-type-filter').value;

    const filtered = sanctions.filter(sanction => {
        const matchesSearch = (sanction.staffMember || '').toLowerCase().includes(search);
        const matchesType = !typeFilter || sanction.type === typeFilter;
        return matchesSearch && matchesType;
    });

    displaySanctions(filtered);
}

// Charger les tâches
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        tasks = await response.json();
        displayTasks(tasks);
    } catch (error) {
        console.error('Erreur chargement tâches:', error);
    }
}

// Afficher les tâches
function displayTasks(tasksToDisplay) {
    const container = document.getElementById('tasks-list');

    if (tasksToDisplay.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucune tâche créée</div>';
        return;
    }

    container.innerHTML = tasksToDisplay.map(task => `
        <div class="card">
            <div class="card-header">
                <div>
                    <span class="card-title">${task.title}</span>
                    <span class="badge badge-${task.status.replace('_', '-')}">${formatTaskStatus(task.status)}</span>
                    <span class="badge badge-${task.priority}">${formatPriority(task.priority)}</span>
                </div>
                <div class="card-actions">
                    ${task.status !== 'completed' ? `
                        <button class="btn btn-success" onclick="updateTaskStatus(${task.id}, '${getNextStatus(task.status)}')">
                            ${getNextStatus(task.status) === 'in_progress' ? 'Commencer' : 'Terminer'}
                        </button>
                    ` : ''}
                    ${currentUser.permissions.canManageTasks ? `
                        <button class="btn btn-danger" onclick="deleteTask(${task.id})">Supprimer</button>
                    ` : ''}
                </div>
            </div>
            <div class="card-body">
                <p>${task.description}</p>
            </div>
            <div class="card-info">
                <div class="card-info-item">
                    <strong>Assignée à</strong>
                    <span>${Array.isArray(task.assignedTo) ? task.assignedTo.join(', ') : task.assignedTo}</span>
                </div>
                <div class="card-info-item">
                    <strong>Par</strong>
                    <span>${task.assignedBy || task.author || 'N/A'}</span>
                </div>
                <div class="card-info-item">
                    <strong>Date</strong>
                    <span>${formatDate(task.date || task.dueDate)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Ajouter une tâche
async function handleAddTask(e) {
    e.preventDefault();

    // Vérifier qu'au moins un utilisateur est sélectionné
    if (selectedUsers.length === 0) {
        alert('Veuillez sélectionner au moins un utilisateur');
        return;
    }

    const newTask = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-description').value,
        assignedTo: selectedUsers.join(', '), // Joindre les utilisateurs avec une virgule
        date: document.getElementById('task-date').value,
        priority: document.getElementById('task-priority').value,
        status: 'pending'
    };

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTask)
        });

        if (response.ok) {
            document.getElementById('task-modal').classList.remove('active');
            document.getElementById('task-form').reset();
            resetMultiSelect(); // Réinitialiser le multi-select
            await loadTasks();
            updateDashboard();
        }
    } catch (error) {
        console.error('Erreur ajout tâche:', error);
    }
}

// Mettre à jour le statut d'une tâche
async function updateTaskStatus(id, newStatus) {
    try {
        await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        await loadTasks();
        updateDashboard();
    } catch (error) {
        console.error('Erreur mise à jour tâche:', error);
    }
}

// Supprimer une tâche
async function deleteTask(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) return;

    try {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        await loadTasks();
        updateDashboard();
    } catch (error) {
        console.error('Erreur suppression tâche:', error);
    }
}

// Filtrer les tâches
function filterTasks() {
    const dateFilter = document.getElementById('task-date-filter').value;
    const statusFilter = document.getElementById('task-status-filter').value;
    const today = new Date().toISOString().split('T')[0];

    const filtered = tasks.filter(task => {
        let matchesDate = true;
        if (dateFilter === 'today') {
            matchesDate = task.date === today;
        } else if (dateFilter === 'week') {
            const taskDate = new Date(task.date);
            const weekFromNow = new Date();
            weekFromNow.setDate(weekFromNow.getDate() + 7);
            matchesDate = taskDate <= weekFromNow;
        }

        const matchesStatus = !statusFilter || task.status === statusFilter;
        return matchesDate && matchesStatus;
    });

    displayTasks(filtered);
}

// Charger les annonces
async function loadAnnouncements() {
    try {
        const response = await fetch('/api/announcements');
        announcements = await response.json();
        displayAnnouncements(announcements);
    } catch (error) {
        console.error('Erreur chargement annonces:', error);
    }
}

// Afficher les annonces
function displayAnnouncements(announcementsToDisplay) {
    const container = document.getElementById('announcements-list');

    if (announcementsToDisplay.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucune annonce publiée</div>';
        return;
    }

    container.innerHTML = announcementsToDisplay.map(announcement => {
        const isReunion = announcement.type === 'reunion';
        const attendance = announcement.attendance || { present: [], absent: [] };
        const userStatus = attendance.present.includes(currentUser.username) ? 'present'
                         : attendance.absent.includes(currentUser.username) ? 'absent'
                         : null;

        return `
        <div class="card">
            <div class="card-header">
                <div>
                    <span class="card-title">${announcement.title}</span>
                    <span class="badge badge-${announcement.type}">${formatAnnouncementType(announcement.type)}</span>
                    ${announcement.priority === 'high' ? '<span class="badge badge-high">Priorité haute</span>' : ''}
                </div>
                ${currentUser.permissions.canManageAnnouncements ? `
                    <div class="card-actions">
                        <button class="btn btn-danger" onclick="deleteAnnouncement(${announcement.id})">Supprimer</button>
                    </div>
                ` : ''}
            </div>
            <div class="card-body">
                <p>${announcement.content}</p>
            </div>
            ${isReunion ? `
                <div class="attendance-section">
                    <div class="attendance-buttons">
                        <button class="btn ${userStatus === 'present' ? 'btn-success' : 'btn-outline-success'}"
                                onclick="markAttendance(${announcement.id}, 'present')">
                            ✓ Présent ${userStatus === 'present' ? '(Vous)' : ''}
                        </button>
                        <button class="btn ${userStatus === 'absent' ? 'btn-danger' : 'btn-outline-danger'}"
                                onclick="markAttendance(${announcement.id}, 'absent')">
                            ✗ Absent ${userStatus === 'absent' ? '(Vous)' : ''}
                        </button>
                    </div>
                    <div class="attendance-lists">
                        <div class="attendance-list">
                            <strong>Présents (${attendance.present.length}):</strong>
                            <span>${attendance.present.length > 0 ? attendance.present.join(', ') : 'Aucun'}</span>
                        </div>
                        <div class="attendance-list">
                            <strong>Absents (${attendance.absent.length}):</strong>
                            <span>${attendance.absent.length > 0 ? attendance.absent.join(', ') : 'Aucun'}</span>
                        </div>
                    </div>
                </div>
            ` : ''}
            <div class="card-info">
                <div class="card-info-item">
                    <strong>Auteur</strong>
                    <span>${announcement.author}</span>
                </div>
                <div class="card-info-item">
                    <strong>Date</strong>
                    <span>${formatDate(announcement.date)}</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// Ajouter une annonce
async function handleAddAnnouncement(e) {
    e.preventDefault();

    const newAnnouncement = {
        title: document.getElementById('announcement-title').value,
        content: document.getElementById('announcement-content').value,
        type: document.getElementById('announcement-type').value,
        priority: document.getElementById('announcement-priority').value
    };

    try {
        const response = await fetch('/api/announcements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAnnouncement)
        });

        if (response.ok) {
            document.getElementById('announcement-modal').classList.remove('active');
            document.getElementById('announcement-form').reset();
            await loadAnnouncements();
            updateDashboard();
        }
    } catch (error) {
        console.error('Erreur ajout annonce:', error);
    }
}

// Supprimer une annonce
async function deleteAnnouncement(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette annonce ?')) return;

    try {
        await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
        await loadAnnouncements();
        updateDashboard();
    } catch (error) {
        console.error('Erreur suppression annonce:', error);
    }
}

// Marquer sa présence à une réunion
async function markAttendance(announcementId, status) {
    try {
        const response = await fetch(`/api/announcements/${announcementId}/attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            await loadAnnouncements();
        } else {
            const data = await response.json();
            alert(data.error || 'Erreur lors de la mise à jour de la présence');
        }
    } catch (error) {
        console.error('Erreur mise à jour présence:', error);
        alert('Erreur lors de la mise à jour de la présence');
    }
}

// ========== GESTION DES ABSENCES ==========

// Charger les absences
async function loadAbsences() {
    try {
        const response = await fetch('/api/absences');
        absences = await response.json();
        displayAbsences(absences);
    } catch (error) {
        console.error('Erreur chargement absences:', error);
    }
}

// Afficher les absences
function displayAbsences(absencesToDisplay) {
    const container = document.getElementById('absences-list');

    if (absencesToDisplay.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucune absence enregistrée</div>';
        return;
    }

    container.innerHTML = absencesToDisplay.map(absence => {
        const startDate = new Date(absence.startDate);
        const endDate = new Date(absence.endDate);
        const now = new Date();
        const isActive = absence.status === 'active';
        const isMyAbsence = absence.username === currentUser.username;

        return `
        <div class="card ${!isActive ? 'card-inactive' : ''}">
            <div class="card-header">
                <div>
                    <span class="card-title">${absence.username}</span>
                    <span class="badge badge-${isActive ? 'info' : 'secondary'}">${isActive ? 'En cours' : 'Terminée'}</span>
                </div>
                ${isMyAbsence || currentUser.permissions.canManageUsers ? `
                    <div class="card-actions">
                        <button class="btn btn-danger" onclick="deleteAbsence(${absence.id})">Supprimer</button>
                    </div>
                ` : ''}
            </div>
            <div class="card-body">
                <p><strong>Raison:</strong> ${absence.reason}</p>
            </div>
            <div class="card-info">
                <div class="card-info-item">
                    <strong>Début</strong>
                    <span>${formatDate(absence.startDate)}</span>
                </div>
                <div class="card-info-item">
                    <strong>Fin</strong>
                    <span>${formatDate(absence.endDate)}</span>
                </div>
                <div class="card-info-item">
                    <strong>Durée</strong>
                    <span>${Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))} jour(s)</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// Ajouter une absence
async function handleAddAbsence(e) {
    e.preventDefault();

    const startDate = document.getElementById('absence-start-date').value;
    const endDate = document.getElementById('absence-end-date').value;

    // Vérifier que la date de fin est après la date de début
    if (new Date(endDate) < new Date(startDate)) {
        alert('La date de fin doit être après la date de début');
        return;
    }

    const newAbsence = {
        reason: document.getElementById('absence-reason').value,
        startDate: startDate,
        endDate: endDate
    };

    try {
        const response = await fetch('/api/absences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAbsence)
        });

        if (response.ok) {
            document.getElementById('absence-modal').classList.remove('active');
            document.getElementById('absence-form').reset();
            await loadAbsences();
        }
    } catch (error) {
        console.error('Erreur ajout absence:', error);
    }
}

// Supprimer une absence
async function deleteAbsence(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette absence ?')) return;

    try {
        const response = await fetch(`/api/absences/${id}`, { method: 'DELETE' });

        if (response.ok) {
            await loadAbsences();
        } else {
            const data = await response.json();
            alert(data.error || 'Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Erreur suppression absence:', error);
    }
}

// Mettre à jour le tableau de bord
function updateDashboard() {
    // Statistiques
    document.getElementById('total-sanctions').textContent = sanctions.length;
    document.getElementById('pending-tasks').textContent =
        tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
    document.getElementById('total-announcements').textContent = announcements.length;

    // Mes tâches du jour
    const today = new Date().toISOString().split('T')[0];
    const myTasksToday = tasks.filter(t => {
        // Gérer à la fois le format array et string pour assignedTo
        const assignedUsers = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
        const isAssignedToMe = assignedUsers.some(user =>
            user.trim() === currentUser.username ||
            t.assignedTo === currentUser.username ||
            (typeof t.assignedTo === 'string' && t.assignedTo.includes(currentUser.username))
        );
        return isAssignedToMe && t.date === today;
    });

    const myTasksContainer = document.getElementById('my-tasks-today');
    if (myTasksToday.length === 0) {
        myTasksContainer.innerHTML = '<p class="empty-state">Aucune tâche pour aujourd\'hui</p>';
    } else {
        myTasksContainer.innerHTML = myTasksToday.map(task => `
            <div class="card">
                <div class="card-header">
                    <div>
                        <span class="card-title">${task.title}</span>
                        <span class="badge badge-${task.status.replace('_', '-')}">${formatTaskStatus(task.status)}</span>
                    </div>
                    <div class="card-actions">
                        ${task.status !== 'completed' ? `
                            <button class="btn ${task.status === 'pending' ? 'btn-primary' : 'btn-success'}" onclick="updateTaskStatus(${task.id}, '${getNextStatus(task.status)}')">
                                ${getNextStatus(task.status) === 'in_progress' ? 'Commencer' : 'Terminer'}
                            </button>
                        ` : '<span class="badge badge-success">✓ Terminée</span>'}
                    </div>
                </div>
                <div class="card-body">
                    <p>${task.description}</p>
                </div>
            </div>
        `).join('');
    }

    // Annonces récentes (3 dernières)
    const recentAnnouncementsContainer = document.getElementById('recent-announcements');
    const recentAnnouncements = announcements.slice(-3).reverse();

    if (recentAnnouncements.length === 0) {
        recentAnnouncementsContainer.innerHTML = '<p class="empty-state">Aucune annonce récente</p>';
    } else {
        recentAnnouncementsContainer.innerHTML = recentAnnouncements.map(announcement => `
            <div class="card">
                <div class="card-header">
                    <div>
                        <span class="card-title">${announcement.title}</span>
                        <span class="badge badge-${announcement.type}">${formatAnnouncementType(announcement.type)}</span>
                    </div>
                </div>
                <div class="card-body">
                    <p>${announcement.content}</p>
                </div>
            </div>
        `).join('');
    }
}

// Fonctions utilitaires de formatage
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatSanctionType(type) {
    const types = {
        'avertissement_1': 'Avertissement 1',
        'avertissement_2': 'Avertissement 2',
        'avertissement_3': 'Avertissement 3'
    };
    return types[type] || type;
}

function formatTaskStatus(status) {
    const statuses = {
        'pending': 'En attente',
        'in_progress': 'En cours',
        'completed': 'Terminée'
    };
    return statuses[status] || status;
}

function formatPriority(priority) {
    const priorities = {
        'low': 'Basse',
        'medium': 'Moyenne',
        'high': 'Haute'
    };
    return priorities[priority] || priority;
}

function formatAnnouncementType(type) {
    const types = {
        'info': 'Information',
        'reunion': 'Réunion',
        'urgent': 'Urgent'
    };
    return types[type] || type;
}

function getNextStatus(currentStatus) {
    if (currentStatus === 'pending') return 'in_progress';
    if (currentStatus === 'in_progress') return 'completed';
    return currentStatus;
}

// ========== GESTION DES UTILISATEURS ==========

// Charger la liste des noms d'utilisateurs
async function loadUsersList() {
    try {
        const response = await fetch('/api/users/list');
        allUsernames = await response.json();
        // Attendre que le DOM soit chargé avant de configurer le multi-select
        setTimeout(() => {
            setupMultiSelect();
            updateDropdownOptions();
            updateStaffMembersDropdown(); // Mettre à jour le dropdown des sanctions
            setupStaffMembersMultiSelect(); // Initialiser le multi-select pour sanctions
        }, 100);
    } catch (error) {
        console.error('Erreur chargement liste utilisateurs:', error);
    }
}

// Charger les utilisateurs (admin uniquement)
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        users = await response.json();
        displayUsers(users);
    } catch (error) {
        console.error('Erreur chargement utilisateurs:', error);
    }
}

// Afficher les utilisateurs
function displayUsers(usersToDisplay) {
    const container = document.getElementById('users-list');

    if (!container) return;

    if (usersToDisplay.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="empty-state">Aucun utilisateur</td></tr>';
        return;
    }

    container.innerHTML = usersToDisplay.map(user => `
        <tr>
            <td>${user.username}</td>
            <td><span class="badge badge-info">${user.role}</span></td>
            <td>
                ${user.permissions.canManageSanctions ? '<span class="badge badge-success">Sanctions</span> ' : ''}
                ${user.permissions.canManageTasks ? '<span class="badge badge-success">Tâches</span> ' : ''}
                ${user.permissions.canManageAnnouncements ? '<span class="badge badge-success">Annonces</span> ' : ''}
                ${user.permissions.canManageUsers ? '<span class="badge badge-success">Utilisateurs</span> ' : ''}
            </td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                <button class="btn btn-secondary" onclick="openPasswordModal(${user.id}, '${user.username}')" style="margin-right: 10px;">Modifier MDP</button>
                <button class="btn btn-danger" onclick="deleteUser(${user.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
}

// Ajouter un utilisateur
async function handleAddUser(e) {
    e.preventDefault();

    const newUser = {
        username: document.getElementById('new-username').value,
        password: document.getElementById('new-password').value,
        role: document.getElementById('new-role').value,
        permissions: {
            canManageSanctions: document.getElementById('perm-sanctions').checked,
            canManageTasks: document.getElementById('perm-tasks').checked,
            canManageAnnouncements: document.getElementById('perm-announcements').checked,
            canManageUsers: document.getElementById('perm-users').checked
        }
    };

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser)
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('user-modal').classList.remove('active');
            document.getElementById('user-form').reset();
            await loadUsers();
            await loadUsersList(); // Recharger la liste pour le multi-select
        } else {
            alert(data.error || 'Erreur lors de la création du compte');
        }
    } catch (error) {
        console.error('Erreur ajout utilisateur:', error);
        alert('Erreur lors de la création du compte');
    }
}

// Supprimer un utilisateur
async function deleteUser(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;

    try {
        const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        const data = await response.json();

        if (response.ok) {
            await loadUsers();
            await loadUsersList(); // Recharger la liste pour le multi-select
        } else {
            alert(data.error || 'Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Erreur suppression utilisateur:', error);
    }
}

// ========== MULTI-SELECT POUR ASSIGNATION ==========

let multiSelectInitialized = false;

// Configurer le multi-select
function setupMultiSelect() {
    const display = document.getElementById('task-assigned-display');
    const dropdown = document.getElementById('task-assigned-dropdown');

    if (!display || !dropdown) return;

    // Éviter d'ajouter les événements plusieurs fois
    if (multiSelectInitialized) return;
    multiSelectInitialized = true;

    // Afficher/masquer le dropdown
    display.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        updateDropdownOptions();
    });

    // Fermer le dropdown si on clique ailleurs
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.multi-select-container')) {
            dropdown.classList.remove('active');
        }
    });
}

// Mettre à jour les options du dropdown
function updateDropdownOptions() {
    const dropdown = document.getElementById('task-assigned-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = allUsernames.map(username => `
        <div class="multi-select-option ${selectedUsers.includes(username) ? 'selected' : ''}"
             onclick="toggleUserSelection('${username}')">
            ${username}
        </div>
    `).join('');
}

// Basculer la sélection d'un utilisateur
function toggleUserSelection(username) {
    const index = selectedUsers.indexOf(username);

    if (index > -1) {
        selectedUsers.splice(index, 1);
    } else {
        selectedUsers.push(username);
    }

    updateMultiSelectDisplay();
    updateDropdownOptions();
    updateHiddenInput();
}

// Mettre à jour l'affichage du multi-select
function updateMultiSelectDisplay() {
    const display = document.getElementById('task-assigned-display');
    if (!display) return;

    if (selectedUsers.length === 0) {
        display.innerHTML = '<span class="multi-select-placeholder">Sélectionner des utilisateurs...</span>';
    } else {
        display.innerHTML = selectedUsers.map(username => `
            <span class="selected-user-tag">
                ${username}
                <span class="remove" onclick="event.stopPropagation(); toggleUserSelection('${username}')">×</span>
            </span>
        `).join('');
    }
}

// Mettre à jour l'input caché
function updateHiddenInput() {
    const input = document.getElementById('task-assigned');
    if (input) {
        input.value = selectedUsers.join(',');
    }
}

// Réinitialiser le multi-select
function resetMultiSelect() {
    selectedUsers = [];
    updateMultiSelectDisplay();
    updateHiddenInput();
}

// ========== MODIFICATION MOT DE PASSE ==========

// Ouvrir le modal de modification de mot de passe
function openPasswordModal(userId, username) {
    document.getElementById('edit-user-id').value = userId;
    document.querySelector('#password-modal h3').textContent = `Modifier le mot de passe de ${username}`;
    document.getElementById('password-modal').classList.add('active');
}

// Modifier le mot de passe
async function handleChangePassword(e) {
    e.preventDefault();

    const userId = document.getElementById('edit-user-id').value;
    const newPassword = document.getElementById('edit-password').value;
    const confirmPassword = document.getElementById('edit-password-confirm').value;

    if (newPassword !== confirmPassword) {
        alert('Les mots de passe ne correspondent pas');
        return;
    }

    if (newPassword.length < 4) {
        alert('Le mot de passe doit contenir au moins 4 caractères');
        return;
    }

    try {
        const response = await fetch(`/api/users/${userId}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('password-modal').classList.remove('active');
            document.getElementById('password-form').reset();
            alert('Mot de passe modifié avec succès');
        } else {
            alert(data.error || 'Erreur lors de la modification');
        }
    } catch (error) {
        console.error('Erreur modification mot de passe:', error);
        alert('Erreur lors de la modification du mot de passe');
    }
}

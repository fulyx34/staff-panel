const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'gta-rp-staff-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Helper functions pour lire/écrire les fichiers JSON
async function readJSON(filename) {
    try {
        const data = await fs.readFile(path.join(__dirname, 'data', filename), 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Erreur lecture ${filename}:`, error);
        return null;
    }
}

async function writeJSON(filename, data) {
    try {
        await fs.writeFile(
            path.join(__dirname, 'data', filename),
            JSON.stringify(data, null, 2),
            'utf8'
        );
        return true;
    } catch (error) {
        console.error(`Erreur écriture ${filename}:`, error);
        return false;
    }
}

// Middleware de vérification de connexion
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Non authentifié' });
    }
}

// Routes d'authentification
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const data = await readJSON('users.json');

    const user = data.users.find(u => u.username === username && u.password === password);

    if (user) {
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions
        };
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(401).json({ error: 'Identifiants incorrects' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/session', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ error: 'Non authentifié' });
    }
});

// Routes pour les sanctions
app.get('/api/sanctions', requireAuth, async (req, res) => {
    const data = await readJSON('sanctions.json');
    res.json(data.sanctions);
});

app.post('/api/sanctions', requireAuth, async (req, res) => {
    if (!req.session.user.permissions.canManageSanctions) {
        return res.status(403).json({ error: 'Permission refusée' });
    }

    const data = await readJSON('sanctions.json');
    const newSanction = {
        id: data.sanctions.length > 0 ? Math.max(...data.sanctions.map(s => s.id)) + 1 : 1,
        staffMember: req.body.staffMember,
        type: req.body.type,
        reason: req.body.reason,
        notes: req.body.notes || '',
        author: req.session.user.username,
        date: new Date().toISOString()
    };

    data.sanctions.push(newSanction);
    await writeJSON('sanctions.json', data);
    res.json(newSanction);
});

app.delete('/api/sanctions/:id', requireAuth, async (req, res) => {
    if (!req.session.user.permissions.canManageSanctions) {
        return res.status(403).json({ error: 'Permission refusée' });
    }

    const data = await readJSON('sanctions.json');
    data.sanctions = data.sanctions.filter(s => s.id !== parseInt(req.params.id));
    await writeJSON('sanctions.json', data);
    res.json({ success: true });
});

// Routes pour les tâches
app.get('/api/tasks', requireAuth, async (req, res) => {
    const data = await readJSON('tasks.json');
    res.json(data.tasks);
});

app.post('/api/tasks', requireAuth, async (req, res) => {
    if (!req.session.user.permissions.canManageTasks) {
        return res.status(403).json({ error: 'Permission refusée' });
    }

    const data = await readJSON('tasks.json');
    const newTask = {
        id: data.tasks.length > 0 ? Math.max(...data.tasks.map(t => t.id)) + 1 : 1,
        ...req.body,
        assignedBy: req.session.user.username,
        createdAt: new Date().toISOString()
    };

    data.tasks.push(newTask);
    await writeJSON('tasks.json', data);
    res.json(newTask);
});

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
    const data = await readJSON('tasks.json');
    const taskIndex = data.tasks.findIndex(t => t.id === parseInt(req.params.id));

    if (taskIndex !== -1) {
        data.tasks[taskIndex] = { ...data.tasks[taskIndex], ...req.body };
        await writeJSON('tasks.json', data);
        res.json(data.tasks[taskIndex]);
    } else {
        res.status(404).json({ error: 'Tâche non trouvée' });
    }
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
    if (!req.session.user.permissions.canManageTasks) {
        return res.status(403).json({ error: 'Permission refusée' });
    }

    const data = await readJSON('tasks.json');
    data.tasks = data.tasks.filter(t => t.id !== parseInt(req.params.id));
    await writeJSON('tasks.json', data);
    res.json({ success: true });
});

// Routes pour les annonces
app.get('/api/announcements', requireAuth, async (req, res) => {
    const data = await readJSON('announcements.json');
    res.json(data.announcements);
});

app.post('/api/announcements', requireAuth, async (req, res) => {
    if (!req.session.user.permissions.canManageAnnouncements) {
        return res.status(403).json({ error: 'Permission refusée' });
    }

    const data = await readJSON('announcements.json');
    const newAnnouncement = {
        id: data.announcements.length > 0 ? Math.max(...data.announcements.map(a => a.id)) + 1 : 1,
        ...req.body,
        author: req.session.user.username,
        date: new Date().toISOString()
    };

    data.announcements.push(newAnnouncement);
    await writeJSON('announcements.json', data);
    res.json(newAnnouncement);
});

app.delete('/api/announcements/:id', requireAuth, async (req, res) => {
    if (!req.session.user.permissions.canManageAnnouncements) {
        return res.status(403).json({ error: 'Permission refusée' });
    }

    const data = await readJSON('announcements.json');
    data.announcements = data.announcements.filter(a => a.id !== parseInt(req.params.id));
    await writeJSON('announcements.json', data);
    res.json({ success: true });
});

// Route pour marquer sa présence à une réunion
app.post('/api/announcements/:id/attendance', requireAuth, async (req, res) => {
    const announcementId = parseInt(req.params.id);
    const { status } = req.body; // "present" ou "absent"

    const data = await readJSON('announcements.json');
    const announcement = data.announcements.find(a => a.id === announcementId);

    if (!announcement) {
        return res.status(404).json({ error: 'Annonce non trouvée' });
    }

    if (announcement.type !== 'reunion') {
        return res.status(400).json({ error: 'Cette annonce n\'est pas une réunion' });
    }

    // Initialiser attendance si nécessaire
    if (!announcement.attendance) {
        announcement.attendance = {
            present: [],
            absent: []
        };
    }

    const username = req.session.user.username;

    // Retirer l'utilisateur des deux listes
    announcement.attendance.present = announcement.attendance.present.filter(u => u !== username);
    announcement.attendance.absent = announcement.attendance.absent.filter(u => u !== username);

    // Ajouter l'utilisateur à la liste appropriée
    if (status === 'present') {
        announcement.attendance.present.push(username);
    } else if (status === 'absent') {
        announcement.attendance.absent.push(username);
    }

    await writeJSON('announcements.json', data);
    res.json({ success: true, attendance: announcement.attendance });
});

// Routes pour les utilisateurs
app.get('/api/users', requireAuth, async (req, res) => {
    if (!req.session.user.permissions.canManageUsers) {
        return res.status(403).json({ error: 'Permission refusée' });
    }

    const data = await readJSON('users.json');
    // Ne pas envoyer les mots de passe
    const users = data.users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        permissions: u.permissions,
        createdAt: u.createdAt
    }));
    res.json(users);
});

app.post('/api/users', requireAuth, async (req, res) => {
    if (!req.session.user.permissions.canManageUsers) {
        return res.status(403).json({ error: 'Permission refusée' });
    }

    const data = await readJSON('users.json');

    // Vérifier si le nom d'utilisateur existe déjà
    if (data.users.find(u => u.username === req.body.username)) {
        return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
    }

    const newUser = {
        id: data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1,
        username: req.body.username,
        password: req.body.password,
        role: req.body.role,
        permissions: req.body.permissions,
        createdAt: new Date().toISOString()
    };

    data.users.push(newUser);
    await writeJSON('users.json', data);

    // Ne pas renvoyer le mot de passe
    const { password, ...userWithoutPassword } = newUser;
    res.json(userWithoutPassword);
});

app.put('/api/users/:id/password', requireAuth, async (req, res) => {
    if (!req.session.user.permissions.canManageUsers) {
        return res.status(403).json({ error: 'Permission refusée' });
    }

    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 4 caractères' });
    }

    const data = await readJSON('users.json');
    const userIndex = data.users.findIndex(u => u.id === userId);

    if (userIndex !== -1) {
        data.users[userIndex].password = newPassword;
        await writeJSON('users.json', data);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
    if (!req.session.user.permissions.canManageUsers) {
        return res.status(403).json({ error: 'Permission refusée' });
    }

    const userId = parseInt(req.params.id);

    // Empêcher la suppression de son propre compte
    if (userId === req.session.user.id) {
        return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const data = await readJSON('users.json');
    data.users = data.users.filter(u => u.id !== userId);
    await writeJSON('users.json', data);
    res.json({ success: true });
});

// Route pour obtenir la liste de tous les noms d'utilisateurs (pour le multi-select)
app.get('/api/users/list', requireAuth, async (req, res) => {
    const data = await readJSON('users.json');
    const usernames = data.users.map(u => u.username);
    res.json(usernames);
});

// ========== GESTION DES ABSENCES ==========

// Routes pour les absences
app.get('/api/absences', requireAuth, async (req, res) => {
    const data = await readJSON('absences.json');

    // Mettre à jour le statut des absences expirées
    const now = new Date();
    data.absences.forEach(absence => {
        const endDate = new Date(absence.endDate);
        if (endDate < now && absence.status === 'active') {
            absence.status = 'inactive';
        }
    });

    await writeJSON('absences.json', data);
    res.json(data.absences);
});

app.post('/api/absences', requireAuth, async (req, res) => {
    const data = await readJSON('absences.json');
    const newAbsence = {
        id: data.absences.length > 0 ? Math.max(...data.absences.map(a => a.id)) + 1 : 1,
        username: req.session.user.username,
        reason: req.body.reason,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        status: 'active',
        createdAt: new Date().toISOString()
    };

    data.absences.push(newAbsence);
    await writeJSON('absences.json', data);
    res.json(newAbsence);
});

app.delete('/api/absences/:id', requireAuth, async (req, res) => {
    const data = await readJSON('absences.json');
    const absenceId = parseInt(req.params.id);
    const absence = data.absences.find(a => a.id === absenceId);

    // Vérifier que l'utilisateur est le propriétaire de l'absence ou est admin
    if (absence && (absence.username === req.session.user.username || req.session.user.permissions.canManageUsers)) {
        data.absences = data.absences.filter(a => a.id !== absenceId);
        await writeJSON('absences.json', data);
        res.json({ success: true });
    } else {
        res.status(403).json({ error: 'Permission refusée' });
    }
});

// ========== SYSTÈME DE SALON DE RÉUNION ==========

// Structure pour stocker les salons actifs
const meetingRooms = new Map();
const activeMeetingsList = [];

// Socket.IO pour les salons de réunion
io.on('connection', (socket) => {
    console.log('Utilisateur connecté:', socket.id);

    // Obtenir la liste des salons actifs
    socket.on('get-active-meetings', () => {
        socket.emit('active-meetings', activeMeetingsList);
    });

    // Créer un salon
    socket.on('create-meeting', ({ roomId, roomName, creator }) => {
        const meeting = {
            roomId,
            roomName,
            creator,
            participants: 0,
            createdAt: new Date().toISOString()
        };
        activeMeetingsList.push(meeting);

        // Notifier tous les clients
        io.emit('meeting-created', meeting);
    });

    // Fermer un salon
    socket.on('close-meeting', ({ roomId }) => {
        const index = activeMeetingsList.findIndex(m => m.roomId === roomId);
        if (index > -1) {
            activeMeetingsList.splice(index, 1);
            io.emit('meeting-closed', { roomId });
        }

        // Supprimer le salon de la map
        if (meetingRooms.has(roomId)) {
            meetingRooms.delete(roomId);
        }
    });

    // Rejoindre un salon
    socket.on('join-room', ({ roomId, username, canSpeak }) => {
        socket.join(roomId);

        if (!meetingRooms.has(roomId)) {
            meetingRooms.set(roomId, {
                id: roomId,
                participants: new Map(),
                screenSharing: null
            });
        }

        const room = meetingRooms.get(roomId);
        room.participants.set(socket.id, {
            id: socket.id,
            username,
            canSpeak,
            isMuted: false,
            isScreenSharing: false
        });

        // Notifier tous les participants du nouveau membre
        io.to(roomId).emit('user-joined', {
            userId: socket.id,
            username,
            canSpeak,
            participants: Array.from(room.participants.values())
        });

        // Envoyer la liste des participants au nouveau membre
        socket.emit('room-users', Array.from(room.participants.values()));
    });

    // Signaling pour WebRTC
    socket.on('offer', ({ to, offer }) => {
        socket.to(to).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ to, answer }) => {
        socket.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
        socket.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    // Inviter quelqu'un à parler
    socket.on('invite-to-speak', ({ roomId, userId }) => {
        const room = meetingRooms.get(roomId);
        if (room && room.participants.has(userId)) {
            const participant = room.participants.get(userId);
            participant.canSpeak = true;
            io.to(roomId).emit('user-permission-changed', { userId, canSpeak: true });
        }
    });

    // Révoquer le droit de parole
    socket.on('revoke-speak', ({ roomId, userId }) => {
        const room = meetingRooms.get(roomId);
        if (room && room.participants.has(userId)) {
            const participant = room.participants.get(userId);
            participant.canSpeak = false;
            io.to(roomId).emit('user-permission-changed', { userId, canSpeak: false });
        }
    });

    // Mute/Unmute
    socket.on('toggle-mute', ({ roomId, isMuted }) => {
        const room = meetingRooms.get(roomId);
        if (room && room.participants.has(socket.id)) {
            const participant = room.participants.get(socket.id);
            participant.isMuted = isMuted;
            io.to(roomId).emit('user-muted', { userId: socket.id, isMuted });
        }
    });

    // Démarrer le partage d'écran
    socket.on('start-screen-share', ({ roomId }) => {
        const room = meetingRooms.get(roomId);
        if (room) {
            room.screenSharing = socket.id;
            io.to(roomId).emit('screen-share-started', { userId: socket.id });
        }
    });

    // Arrêter le partage d'écran
    socket.on('stop-screen-share', ({ roomId }) => {
        const room = meetingRooms.get(roomId);
        if (room && room.screenSharing === socket.id) {
            room.screenSharing = null;
            io.to(roomId).emit('screen-share-stopped', { userId: socket.id });
        }
    });

    // Quitter un salon
    socket.on('leave-room', ({ roomId }) => {
        handleUserLeave(socket.id, roomId);
    });

    // Déconnexion
    socket.on('disconnect', () => {
        // Trouver tous les salons où l'utilisateur est présent
        meetingRooms.forEach((room, roomId) => {
            if (room.participants.has(socket.id)) {
                handleUserLeave(socket.id, roomId);
            }
        });
    });
});

function handleUserLeave(socketId, roomId) {
    const room = meetingRooms.get(roomId);
    if (room) {
        room.participants.delete(socketId);

        // Si le partage d'écran était actif, l'arrêter
        if (room.screenSharing === socketId) {
            room.screenSharing = null;
            io.to(roomId).emit('screen-share-stopped', { userId: socketId });
        }

        // Notifier les autres participants
        io.to(roomId).emit('user-left', {
            userId: socketId,
            participants: Array.from(room.participants.values())
        });

        // Supprimer le salon s'il est vide
        if (room.participants.size === 0) {
            meetingRooms.delete(roomId);
        }
    }
}

server.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

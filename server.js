const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./database');

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
    try {
        const { username, password } = req.body;
        const user = await db.getUserByUsername(username);

        if (user && user.password === password) {
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
    } catch (error) {
        console.error('Erreur login:', error);
        res.status(500).json({ error: 'Erreur serveur' });
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
    try {
        const sanctions = await db.getSanctions();
        res.json(sanctions);
    } catch (error) {
        console.error('Erreur récupération sanctions:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/sanctions', requireAuth, async (req, res) => {
    try {
        if (!req.session.user.permissions.canManageSanctions) {
            return res.status(403).json({ error: 'Permission refusée' });
        }

        const newSanction = await db.createSanction(
            req.body.staffMember,
            req.body.type,
            req.body.reason,
            req.body.notes || '',
            req.session.user.username
        );
        res.json(newSanction);
    } catch (error) {
        console.error('Erreur création sanction:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.delete('/api/sanctions/:id', requireAuth, async (req, res) => {
    try {
        if (!req.session.user.permissions.canManageSanctions) {
            return res.status(403).json({ error: 'Permission refusée' });
        }

        await db.deleteSanction(parseInt(req.params.id));
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression sanction:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Routes pour les tâches
app.get('/api/tasks', requireAuth, async (req, res) => {
    try {
        const tasks = await db.getTasks();
        res.json(tasks);
    } catch (error) {
        console.error('Erreur récupération tâches:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/tasks', requireAuth, async (req, res) => {
    try {
        if (!req.session.user.permissions.canManageTasks) {
            return res.status(403).json({ error: 'Permission refusée' });
        }

        const newTask = await db.createTask(
            req.body.title,
            req.body.description,
            req.body.assignedTo,
            req.body.date || req.body.dueDate,
            req.session.user.username
        );
        res.json(newTask);
    } catch (error) {
        console.error('Erreur création tâche:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
    try {
        const updatedTask = await db.updateTaskStatus(parseInt(req.params.id), req.body.status);
        if (updatedTask) {
            res.json(updatedTask);
        } else {
            res.status(404).json({ error: 'Tâche non trouvée' });
        }
    } catch (error) {
        console.error('Erreur mise à jour tâche:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
    try {
        if (!req.session.user.permissions.canManageTasks) {
            return res.status(403).json({ error: 'Permission refusée' });
        }

        await db.deleteTask(parseInt(req.params.id));
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression tâche:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Routes pour les annonces
app.get('/api/announcements', requireAuth, async (req, res) => {
    try {
        const announcements = await db.getAnnouncements();
        res.json(announcements);
    } catch (error) {
        console.error('Erreur récupération annonces:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/announcements', requireAuth, async (req, res) => {
    try {
        if (!req.session.user.permissions.canManageAnnouncements) {
            return res.status(403).json({ error: 'Permission refusée' });
        }

        const newAnnouncement = await db.createAnnouncement(
            req.body.title,
            req.body.content,
            req.body.type,
            req.session.user.username
        );
        res.json(newAnnouncement);
    } catch (error) {
        console.error('Erreur création annonce:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.delete('/api/announcements/:id', requireAuth, async (req, res) => {
    try {
        if (!req.session.user.permissions.canManageAnnouncements) {
            return res.status(403).json({ error: 'Permission refusée' });
        }

        await db.deleteAnnouncement(parseInt(req.params.id));
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression annonce:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour marquer sa présence à une réunion
// NOTE: Cette fonctionnalité nécessite une table supplémentaire pour les attendances
// Pour l'instant, on la désactive temporairement
app.post('/api/announcements/:id/attendance', requireAuth, async (req, res) => {
    // TODO: Implémenter avec une table attendance dans PostgreSQL
    res.status(501).json({ error: 'Fonctionnalité non encore implémentée avec PostgreSQL' });
});

// Routes pour les utilisateurs
app.get('/api/users', requireAuth, async (req, res) => {
    try {
        if (!req.session.user.permissions.canManageUsers) {
            return res.status(403).json({ error: 'Permission refusée' });
        }

        const users = await db.getUsers();
        // Ne pas envoyer les mots de passe (déjà filtré par getUsers)
        res.json(users);
    } catch (error) {
        console.error('Erreur récupération utilisateurs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/users', requireAuth, async (req, res) => {
    try {
        if (!req.session.user.permissions.canManageUsers) {
            return res.status(403).json({ error: 'Permission refusée' });
        }

        // Vérifier si le nom d'utilisateur existe déjà
        const existingUser = await db.getUserByUsername(req.body.username);
        if (existingUser) {
            return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
        }

        const newUser = await db.createUser(
            req.body.username,
            req.body.password,
            req.body.role,
            req.body.permissions
        );
        res.json(newUser);
    } catch (error) {
        console.error('Erreur création utilisateur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.put('/api/users/:id/password', requireAuth, async (req, res) => {
    try {
        if (!req.session.user.permissions.canManageUsers) {
            return res.status(403).json({ error: 'Permission refusée' });
        }

        const userId = parseInt(req.params.id);
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 4 caractères' });
        }

        await db.updateUser(userId, { password: newPassword });
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur mise à jour mot de passe:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
    try {
        if (!req.session.user.permissions.canManageUsers) {
            return res.status(403).json({ error: 'Permission refusée' });
        }

        const userId = parseInt(req.params.id);

        // Empêcher la suppression de son propre compte
        if (userId === req.session.user.id) {
            return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
        }

        await db.deleteUser(userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression utilisateur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour obtenir la liste de tous les noms d'utilisateurs (pour le multi-select)
app.get('/api/users/list', requireAuth, async (req, res) => {
    try {
        const usernames = await db.getUsernames();
        res.json(usernames);
    } catch (error) {
        console.error('Erreur récupération usernames:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ========== GESTION DES ABSENCES ==========

// Routes pour les absences
app.get('/api/absences', requireAuth, async (req, res) => {
    try {
        const absences = await db.getAbsences();
        // Le statut est géré côté client (pas de champ status dans la DB)
        res.json(absences);
    } catch (error) {
        console.error('Erreur récupération absences:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/absences', requireAuth, async (req, res) => {
    try {
        const newAbsence = await db.createAbsence(
            req.session.user.username,
            req.body.startDate,
            req.body.endDate,
            req.body.reason
        );
        res.json(newAbsence);
    } catch (error) {
        console.error('Erreur création absence:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.delete('/api/absences/:id', requireAuth, async (req, res) => {
    try {
        const absenceId = parseInt(req.params.id);
        const absences = await db.getAbsences();
        const absence = absences.find(a => a.id === absenceId);

        // Vérifier que l'utilisateur est le propriétaire de l'absence ou est admin
        if (absence && (absence.username === req.session.user.username || req.session.user.permissions.canManageUsers)) {
            await db.deleteAbsence(absenceId);
            res.json({ success: true });
        } else {
            res.status(403).json({ error: 'Permission refusée' });
        }
    } catch (error) {
        console.error('Erreur suppression absence:', error);
        res.status(500).json({ error: 'Erreur serveur' });
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

// Initialiser la base de données et démarrer le serveur
async function startServer() {
    try {
        await db.initDatabase();
        server.listen(PORT, () => {
            console.log(`Serveur démarré sur http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Erreur démarrage serveur:', error);
        process.exit(1);
    }
}

startServer();

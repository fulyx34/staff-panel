// Gestion des salons de réunion avec WebRTC
let socket = null;
let currentRoomId = null;
let localStream = null;
let screenStream = null;
let peers = new Map();
let isMuted = false;
let isScreenSharing = false;
let myUserId = null;
let canSpeak = false;
let participants = new Map();

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    socket = io();

    // Event listeners
    document.getElementById('create-meeting-btn')?.addEventListener('click', openMeetingModal);
    document.getElementById('meeting-form')?.addEventListener('submit', handleCreateMeeting);
    document.getElementById('leave-meeting-btn')?.addEventListener('click', leaveMeeting);
    document.getElementById('toggle-audio-btn')?.addEventListener('click', toggleAudio);
    document.getElementById('share-screen-btn')?.addEventListener('click', toggleScreenShare);

    setupSocketListeners();
});

function openMeetingModal() {
    document.getElementById('meeting-modal').classList.add('active');
}

// Créer et rejoindre un salon
async function handleCreateMeeting(e) {
    e.preventDefault();

    const roomName = document.getElementById('meeting-name').value;
    const permission = document.getElementById('meeting-permission').value;
    canSpeak = permission === 'speaker';

    currentRoomId = generateRoomId();

    // Fermer le modal
    document.getElementById('meeting-modal').classList.remove('active');
    document.getElementById('meeting-form').reset();

    // Afficher la salle de réunion
    document.querySelector('.section-header').style.display = 'none';
    document.getElementById('meeting-room').style.display = 'block';
    document.getElementById('meeting-room-name').textContent = roomName;

    // Demander l'accès au microphone si on peut parler
    if (canSpeak) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Microphone activé');
        } catch (error) {
            console.error('Erreur accès micro:', error);
            alert('Impossible d\'accéder au microphone');
            canSpeak = false;
        }
    }

    // Rejoindre le salon via Socket.IO
    socket.emit('join-room', {
        roomId: currentRoomId,
        username: currentUser.username,
        canSpeak: canSpeak
    });
}

// Quitter le salon
function leaveMeeting() {
    if (currentRoomId) {
        socket.emit('leave-room', { roomId: currentRoomId });
    }

    // Arrêter tous les streams
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    // Fermer toutes les connexions peer
    peers.forEach(peer => peer.destroy());
    peers.clear();

    // Réinitialiser l'interface
    document.querySelector('.section-header').style.display = 'flex';
    document.getElementById('meeting-room').style.display = 'none';
    document.getElementById('screen-share-container').style.display = 'none';
    document.getElementById('participants-list').innerHTML = '';

    currentRoomId = null;
    isMuted = false;
    isScreenSharing = false;
    participants.clear();
}

// Toggle audio (mute/unmute)
function toggleAudio() {
    if (!localStream || !canSpeak) return;

    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
    });

    const btn = document.getElementById('toggle-audio-btn');
    const icon = document.getElementById('audio-icon');

    if (isMuted) {
        btn.classList.remove('btn-success');
        btn.classList.add('btn-danger');
        btn.innerHTML = '<span id="audio-icon">🔇</span> Micro coupé';
    } else {
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-success');
        btn.innerHTML = '<span id="audio-icon">🎤</span> Micro activé';
    }

    socket.emit('toggle-mute', { roomId: currentRoomId, isMuted });
}

// Toggle partage d'écran
async function toggleScreenShare() {
    if (!isScreenSharing) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: false
            });

            const videoElement = document.getElementById('screen-share-video');
            videoElement.srcObject = screenStream;
            document.getElementById('screen-share-container').style.display = 'block';

            isScreenSharing = true;

            const btn = document.getElementById('share-screen-btn');
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-danger');
            btn.innerHTML = '<span>⏹️</span> Arrêter le partage';

            // Notifier les autres
            socket.emit('start-screen-share', { roomId: currentRoomId });

            // Envoyer le stream aux peers existants
            peers.forEach((peer, peerId) => {
                screenStream.getTracks().forEach(track => {
                    peer.addTrack(track, screenStream);
                });
            });

            // Arrêter automatiquement quand l'utilisateur arrête le partage
            screenStream.getVideoTracks()[0].onended = () => {
                stopScreenShare();
            };

        } catch (error) {
            console.error('Erreur partage écran:', error);
            alert('Impossible de partager l\'écran');
        }
    } else {
        stopScreenShare();
    }
}

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    document.getElementById('screen-share-container').style.display = 'none';
    isScreenSharing = false;

    const btn = document.getElementById('share-screen-btn');
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-secondary');
    btn.innerHTML = '<span>🖥️</span> Partager l\'écran';

    socket.emit('stop-screen-share', { roomId: currentRoomId });
}

// Configuration des listeners Socket.IO
function setupSocketListeners() {
    socket.on('connect', () => {
        myUserId = socket.id;
        console.log('Connecté au serveur, ID:', myUserId);
    });

    socket.on('room-users', (users) => {
        users.forEach(user => {
            participants.set(user.id, user);
        });
        updateParticipantsList();
    });

    socket.on('user-joined', ({ userId, username, canSpeak, participants: updatedParticipants }) => {
        console.log('Utilisateur rejoint:', username);

        // Mettre à jour la liste des participants
        updatedParticipants.forEach(p => {
            participants.set(p.id, p);
        });
        updateParticipantsList();

        // Si c'est nous qui venons de rejoindre, ne pas créer de peer
        if (userId === myUserId) return;

        // Créer une connexion peer (nous sommes l'initiateur)
        if (localStream) {
            createPeer(userId, true);
        }
    });

    socket.on('user-left', ({ userId, participants: updatedParticipants }) => {
        console.log('Utilisateur parti:', userId);

        // Fermer la connexion peer
        if (peers.has(userId)) {
            peers.get(userId).destroy();
            peers.delete(userId);
        }

        // Mettre à jour la liste
        participants.delete(userId);
        updateParticipantsList();
    });

    socket.on('offer', async ({ from, offer }) => {
        console.log('Offer reçue de:', from);

        if (!peers.has(from) && localStream) {
            createPeer(from, false);
        }

        const peer = peers.get(from);
        if (peer) {
            peer.signal(offer);
        }
    });

    socket.on('answer', ({ from, answer }) => {
        console.log('Answer reçue de:', from);
        const peer = peers.get(from);
        if (peer) {
            peer.signal(answer);
        }
    });

    socket.on('ice-candidate', ({ from, candidate }) => {
        const peer = peers.get(from);
        if (peer) {
            peer.signal(candidate);
        }
    });

    socket.on('user-permission-changed', ({ userId, canSpeak }) => {
        const participant = participants.get(userId);
        if (participant) {
            participant.canSpeak = canSpeak;

            // Si c'est nous, activer/désactiver le micro
            if (userId === myUserId) {
                canSpeak = canSpeak;
                if (canSpeak && !localStream) {
                    enableMicrophone();
                } else if (!canSpeak && localStream) {
                    disableMicrophone();
                }
            }

            updateParticipantsList();
        }
    });

    socket.on('user-muted', ({ userId, isMuted }) => {
        const participant = participants.get(userId);
        if (participant) {
            participant.isMuted = isMuted;
            updateParticipantsList();
        }
    });

    socket.on('screen-share-started', ({ userId }) => {
        console.log('Partage écran démarré par:', userId);
    });

    socket.on('screen-share-stopped', ({ userId }) => {
        console.log('Partage écran arrêté par:', userId);
        if (userId !== myUserId) {
            document.getElementById('screen-share-container').style.display = 'none';
        }
    });
}

// Créer une connexion WebRTC peer
function createPeer(userId, initiator) {
    console.log(`Création peer pour ${userId}, initiator: ${initiator}`);

    const peer = new SimplePeer({
        initiator: initiator,
        stream: localStream,
        trickle: true,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peer.on('signal', (signal) => {
        if (signal.type === 'offer') {
            socket.emit('offer', { to: userId, offer: signal });
        } else if (signal.type === 'answer') {
            socket.emit('answer', { to: userId, answer: signal });
        } else {
            socket.emit('ice-candidate', { to: userId, candidate: signal });
        }
    });

    peer.on('stream', (stream) => {
        console.log('Stream reçu de:', userId);
        // L'audio sera joué automatiquement
        const audio = new Audio();
        audio.srcObject = stream;
        audio.play().catch(e => console.error('Erreur lecture audio:', e));
    });

    peer.on('error', (err) => {
        console.error('Erreur peer:', err);
    });

    peer.on('close', () => {
        console.log('Peer fermé:', userId);
        peers.delete(userId);
    });

    peers.set(userId, peer);
}

// Activer le microphone
async function enableMicrophone() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Ajouter le stream aux peers existants
        peers.forEach((peer, peerId) => {
            localStream.getTracks().forEach(track => {
                peer.addTrack(track, localStream);
            });
        });

        const btn = document.getElementById('toggle-audio-btn');
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-success');
        btn.disabled = false;

    } catch (error) {
        console.error('Erreur activation micro:', error);
        alert('Impossible d\'activer le microphone');
    }
}

// Désactiver le microphone
function disableMicrophone() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    const btn = document.getElementById('toggle-audio-btn');
    btn.classList.remove('btn-success');
    btn.classList.add('btn-danger');
    btn.disabled = true;
    btn.innerHTML = '<span id="audio-icon">🔇</span> Micro désactivé';
}

// Mettre à jour la liste des participants
function updateParticipantsList() {
    const container = document.getElementById('participants-list');

    container.innerHTML = Array.from(participants.values()).map(participant => {
        const isMe = participant.id === myUserId;
        const statusIcon = participant.canSpeak ? (participant.isMuted ? '🔇' : '🎤') : '🔊';
        const statusText = participant.canSpeak ? (participant.isMuted ? 'Muet' : 'Peut parler') : 'Écoute';

        return `
            <div class="participant-card ${participant.canSpeak ? 'speaker' : 'listener'}" data-user-id="${participant.id}">
                <div class="participant-name">${participant.username}${isMe ? ' (Vous)' : ''}</div>
                <div class="participant-status">
                    <span>${statusIcon}</span>
                    <span>${statusText}</span>
                </div>
                ${!isMe && canSpeak ? `
                    <div class="context-menu" onclick="toggleContextMenu(event, '${participant.id}')">
                        ⋮
                        <div class="context-menu-dropdown" id="menu-${participant.id}">
                            ${!participant.canSpeak ? `
                                <div class="context-menu-item" onclick="inviteToSpeak('${participant.id}')">
                                    ✅ Inviter à parler
                                </div>
                            ` : `
                                <div class="context-menu-item" onclick="revokeSpeak('${participant.id}')">
                                    ❌ Retirer la parole
                                </div>
                            `}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Toggle context menu
function toggleContextMenu(event, userId) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${userId}`);

    // Fermer tous les autres menus
    document.querySelectorAll('.context-menu-dropdown').forEach(m => {
        if (m.id !== `menu-${userId}`) {
            m.classList.remove('active');
        }
    });

    menu.classList.toggle('active');
}

// Fermer les menus au clic ailleurs
document.addEventListener('click', () => {
    document.querySelectorAll('.context-menu-dropdown').forEach(m => {
        m.classList.remove('active');
    });
});

// Inviter quelqu'un à parler
function inviteToSpeak(userId) {
    socket.emit('invite-to-speak', { roomId: currentRoomId, userId });
}

// Révoquer le droit de parole
function revokeSpeak(userId) {
    socket.emit('revoke-speak', { roomId: currentRoomId, userId });
}

// Générer un ID de salon unique
function generateRoomId() {
    return 'room_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Configurer les listeners pour le modal meeting
function setupMeetingModalListeners() {
    const modal = document.getElementById('meeting-modal');
    const close = modal?.querySelector('.close');

    close?.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

setupMeetingModalListeners();

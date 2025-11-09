# Panel Staff - GTA RP

Système de gestion pour les staff d'un serveur GTA RP avec gestion des sanctions, tâches et annonces.

## Fonctionnalités

### Système d'authentification
- Connexion avec nom d'utilisateur et mot de passe
- Gestion des permissions par rôle (admin, moderator)
- Session persistante

### Gestion des sanctions
- Ajout de sanctions (Avertissement 1, 2, 3)
- Visualisation de toutes les sanctions
- Filtrage par nom de joueur et type de sanction
- Suppression des sanctions (admin uniquement)
- Informations détaillées : joueur, ID, raison, staff, date, notes

### Système de tâches
- Création de tâches assignées à des membres du staff
- Gestion par date et priorité (basse, moyenne, haute)
- Statuts : En attente, En cours, Terminée
- Filtrage par date et statut
- Mise à jour du statut des tâches
- Suppression des tâches (admin uniquement)

### Annonces et réunions
- Publication d'annonces (Information, Réunion, Urgent)
- Priorité normale ou haute
- Affichage sur le tableau de bord
- Suppression des annonces (admin uniquement)

### Tableau de bord
- Statistiques en temps réel
- Mes tâches du jour
- Annonces récentes

## Installation

### Prérequis
- Node.js (version 14 ou supérieure)
- npm

### Étapes d'installation

1. Ouvrir un terminal dans le dossier du projet

2. Installer les dépendances :
```bash
npm install
```

3. Démarrer le serveur :
```bash
npm start
```

4. Ouvrir votre navigateur et accéder à :
```
http://localhost:3000
```

## Comptes par défaut

### Admin
- Nom d'utilisateur : `admin`
- Mot de passe : `admin123`
- Permissions : Toutes

### Modérateur
- Nom d'utilisateur : `moderator`
- Mot de passe : `mod123`
- Permissions : Gestion des sanctions uniquement

## Structure du projet

```
Site-staff/
├── data/                      # Base de données JSON
│   ├── users.json            # Comptes utilisateurs
│   ├── sanctions.json        # Sanctions enregistrées
│   ├── tasks.json           # Tâches assignées
│   └── announcements.json   # Annonces publiées
├── public/                   # Fichiers frontend
│   ├── css/
│   │   └── style.css        # Styles de l'application
│   ├── js/
│   │   └── app.js           # Logique frontend
│   └── index.html           # Page principale
├── server.js                # Serveur Express
└── package.json            # Dépendances du projet
```

## Permissions

### Admin
- ✅ Gérer les sanctions
- ✅ Gérer les tâches
- ✅ Gérer les annonces
- ✅ Gérer les utilisateurs

### Modérateur
- ✅ Gérer les sanctions
- ❌ Gérer les tâches
- ❌ Gérer les annonces
- ❌ Gérer les utilisateurs

## Ajout d'un nouvel utilisateur

Éditer le fichier `data/users.json` et ajouter un nouvel objet utilisateur :

```json
{
  "id": 3,
  "username": "nouveau_staff",
  "password": "motdepasse",
  "role": "moderator",
  "permissions": {
    "canManageSanctions": true,
    "canManageTasks": false,
    "canManageAnnouncements": false,
    "canManageUsers": false
  },
  "createdAt": "2025-01-09T00:00:00Z"
}
```

## Sécurité

⚠️ **IMPORTANT** : Cette application est un prototype de base. Pour une utilisation en production, il est recommandé de :

1. Utiliser une vraie base de données (MySQL, PostgreSQL, MongoDB)
2. Hacher les mots de passe (bcrypt)
3. Utiliser HTTPS
4. Implémenter des tokens JWT pour l'authentification
5. Ajouter la validation des données côté serveur
6. Implémenter un système de logs
7. Ajouter la gestion des sessions expirées

## Support

Pour toute question ou problème, contactez l'administrateur du serveur.

## Licence

Projet privé pour serveur GTA RP

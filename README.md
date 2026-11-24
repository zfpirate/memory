# Memory — application multijoueur indirect

Application React/TypeScript proposant un jeu Memory individuel, un classement, une gestion de session et un panel administrateur.

## Fonctionnalités

- Partie indépendante pour chaque joueur avec mélange, chronomètre et compteur de coups
- Session ouverte/fermée
- Pseudo facultatif ou obligatoire
- Classement des meilleurs temps
- Brouillon des cartes avec publication instantanée
- Lien et QR code de partage
- Activation/désactivation du classement
- Statistiques et réinitialisation

## Prototype

Les données sont stockées dans le navigateur avec `localStorage`. Pour un usage réel multi-appareils et multi-utilisateurs, remplacer cette persistance par une API et une base de données.

## Démarrage

```bash
npm install
npm run dev
```

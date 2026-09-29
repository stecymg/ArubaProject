# Kaz di YOL — outil de gestion locative

Application web de suivi des réservations et de planification du ménage pour un parc de locations courte durée à Aruba, commercialisées sur Airbnb et Booking.

Projet personnel, développé pour un besoin réel de gestion à distance.

> **État actuel** — prototype fonctionnel en usage local, mono-utilisateur. La synchronisation des réservations depuis un PMS (Beds24) est en cours d'intégration ; les données sont pour l'instant alimentées manuellement.

---

## Le besoin

Un parc de logements en location courte durée, géré **intégralement à distance**, avec une équipe sur place pour les interventions. Le point critique est l'enchaînement des séjours : entre le départ d'un voyageur et l'arrivée du suivant, le ménage doit être fait dans une fenêtre qui varie selon les réservations — parfois quelques heures, parfois plusieurs jours.

Les plateformes de réservation n'offrent pas cette vue : elles affichent les séjours, pas les créneaux d'intervention entre deux séjours. Calculer ces fenêtres à la main sur plusieurs logements devient vite une source d'erreurs.

L'outil répond à cette question précise : **quand faut-il intervenir, où, et est-ce fait ?**

---

## Fonctionnement

**Calcul automatique des créneaux de ménage**

Une route de synchronisation parcourt les réservations de chaque logement, classées par date, et en déduit pour chacune une fenêtre d'intervention :

- **Début** : à la fin du séjour
- **Fin** : une heure avant l'arrivée suivante, ou trois heures après le départ s'il n'y a pas de réservation derrière

Une garde évite les fenêtres incohérentes lorsque deux séjours s'enchaînent sans marge suffisante.

**Opération rejouable**

L'écriture des tâches se fait par `upsert` avec contrainte d'unicité sur la réservation. La synchronisation peut donc être relancée autant de fois que nécessaire sans créer de doublon — condition indispensable pour un traitement destiné à tourner périodiquement.

**Tableau de bord temps réel**

Les logements, leurs réservations et les tâches associées sont chargés en une seule requête imbriquée. Un abonnement aux changements de la table des tâches met la vue à jour immédiatement : quand une intervention est marquée comme faite, l'affichage suit sans rechargement.

**Accès à la route de synchronisation**

L'endpoint est protégé par un secret passé en paramètre, afin qu'il ne soit pas déclenchable par n'importe qui une fois déployé.

---

## Stack

| Élément | Choix |
|---|---|
| Framework | Next.js 15 (App Router) |
| Interface | React 19 |
| Base de données | PostgreSQL via Supabase |
| Temps réel | Abonnement Supabase Realtime |

**Pourquoi Supabase** — un PostgreSQL managé avec API générée, temps réel intégré et authentification, ce qui évite de construire un back-end complet pour un outil à usage interne. Le modèle reste relationnel, donc migrable.

---

## Modèle de données

```
properties        les logements
    │
    └── reservations        séjours : voyageur, arrivée, départ
            │
            └── cleaning_tasks    fenêtre d'intervention, statut
```

La tâche de ménage est rattachée à la réservation qui la déclenche, avec une contrainte d'unicité sur ce lien — c'est elle qui garantit l'idempotence de la synchronisation.

---

## Installation

```bash
npm install
cp .env.example .env.local   # renseigner les clés Supabase et le secret de sync
npm run dev
```

Variables attendues :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SYNC_SECRET=
```

Déclencher une synchronisation :

```
GET /api/sync?secret=<SYNC_SECRET>
```

---

## Suite envisagée

- Récupération automatique des réservations via l'API du PMS
- Vue Revenue : taux d'occupation, chiffre d'affaires par logement, saisonnalité
- Accès dédié pour l'équipe sur place, limité à la validation des interventions

---

## Ce que le projet m'a apporté

- **Partir d'un besoin, pas d'un énoncé** — définir soi-même le périmètre, en écartant ce qui n'est pas essentiel au lancement.
- **Idempotence** — concevoir un traitement rejouable dès le départ, plutôt que de rattraper les doublons après coup.
- **Modélisation relationnelle** — traduire une réalité métier en tables et contraintes, et laisser la base garantir la cohérence plutôt que le code.
- **Développement web moderne** — un terrain nouveau pour moi, après un parcours orienté systèmes et C.

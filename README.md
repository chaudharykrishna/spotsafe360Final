# SpotSafe 360

SpotSafe 360 is a warehouse hazard-perception training project built as a browser-based 360° safety simulation. The app presents a warehouse goods-in bay and asks the player to identify hazards, learn the correct safety action, and improve hazard-awareness skills.

This repository contains:
- a static front-end in `spotsafe360/`
- a lightweight Node.js backend in `server/server.js`
- a JSON data store in `server/db.json`
- supporting documentation and design files in `spotsafe360/docs/`

## Features
- 360° warehouse scene with interactive hazard spotting
- Training and attack modes
- Quiz and review flow after a round
- Leaderboard and score tracking
- Company/team structure and learner management
- Duel challenge flow
- Local persistence for app data in `server/db.json`

## Project structure

```text
.
├── package.json
├── package-lock.json
├── nocache_server.py
├── server/
│   ├── db.json
│   └── server.js
├── spotsafe360/
│   ├── index.html
│   ├── login.html
│   ├── dashboard.html
│   ├── game.html
│   ├── admin.html
│   ├── css/
│   ├── js/
│   ├── img/
│   ├── vendor/
│   ├── docs/
│   └── README.md
└── tests/
```

## Prerequisites
- Node.js 18+ recommended
- A modern browser (Chrome/Edge recommended)

## Quick start

From the repository root:

```bash
node server/server.js
```

Then open:

```text
http://localhost:8080
```

The server serves the front-end from `spotsafe360/` and exposes the app API under `/api/*`.

## Using the npm script

A convenience script is available:

```bash
npm install
npm start
```

This starts the same server via:

```bash
node server/server.js
```

## Alternative static run

If you want to preview just the front-end without the API server, you can serve the static files directly:

```bash
cd spotsafe360
python3 -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000
```

## Important notes
- The backend is configured to serve the app from `spotsafe360/`.
- The Node server listens on port `8080` by default.
- You can override the port with:

```bash
PORT=3000 node server/server.js
```

- User and score data are stored in `server/db.json`.
- A built-in file `spotsafe360/README.md` already contains project-specific gameplay and controls documentation.

## API overview

The backend includes endpoints for:
- health check: `GET /api/health`
- auth: `POST /api/auth/signup`, `POST /api/auth/login`
- user data: `GET /api/me`
- records and scores: `GET/POST /api/records`, `GET/POST /api/scores`
- company/learner features
- duel challenge routes

## License
This project currently does not declare a specific license in the root package metadata.

## Project documentation
See the app-specific README here:
- `spotsafe360/README.md`

This file contains details about hazards, controls, game flow, and how the training experience is designed.

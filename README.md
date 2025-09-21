# Trace - Environmental Impact Tracker

A full-stack application for tracking the environmental impact of beverages.

## Project Structure

```
trace/
├── client/          # Next.js frontend
├── server/          # Express.js backend with MongoDB
└── README.md
```

## Getting Started

### Server
```bash
cd server
npm install
npm run dev
```

### Client  
```bash
cd client
npm install
npm run dev
```

## Environment Variables

**Server (.env)**
```
MONGO_SRV=your_mongodb_connection_string
PORT=5000
```

**Client (.env.local)**
```
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
NEXT_PUBLIC_MAPBOX_STYLE_URL=your_mapbox_style_url
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

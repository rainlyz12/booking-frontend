# สนามดี — Sports Booking

React + Vite frontend for the [booking-backend](https://github.com/BringzUU/booking-backend) API.

## Run locally

```sh
npm install
npm run dev
```

By default, the app uses `https://booking-backend-c77p.onrender.com`. To use another backend, copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the API origin (without an `/api` suffix), then restart Vite.

## Connected API features

- Loads active rooms from `GET /api/rooms`.
- Registers members with `POST /api/auth/register` and signs them in with `POST /api/auth/login`.
- Keeps the bearer token in `sessionStorage` for the current browser session and checks it with `GET /api/auth/profile`.
- Creates bookings with `POST /api/bookings`, lists the signed-in member's bookings with `GET /api/bookings`, and cancels them with `DELETE /api/bookings/{id}`.
- Displays backend errors, including unavailable rooms and overlapping booking times.

Room prices and availability are not included in the backend API response, so the interface does not claim a price or availability before the booking request is checked by the server.

## Deployment

Configure the backend's `ALLOWED_ORIGINS` environment variable with the exact deployed frontend origin (scheme and hostname, no path or trailing slash). The backend allows local Vite origins by default.

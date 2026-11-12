# สนามดี — Sports Booking

React frontend for the [booking-backend](https://github.com/BringzUU/booking-backend) API, built with Create React App.

## Run locally

```sh
npm install
npm start
```

By default, the app uses `https://booking-backend-c77p.onrender.com`. To use another backend, copy `.env.example` to `.env` and set `REACT_APP_API_BASE_URL` to the API origin (without an `/api` suffix), then restart the development server.

## Connected API features

- Loads active rooms from `GET /api/rooms`.
- Registers members with `POST /api/auth/register` and signs them in with `POST /api/auth/login`.
- Keeps the bearer token in `sessionStorage` for the current browser session and checks it with `GET /api/auth/profile`.
- Creates bookings with `POST /api/bookings`, lists the signed-in member's bookings with `GET /api/bookings`, and cancels them with `DELETE /api/bookings/{id}`.
- Checks occupied periods before booking, asks members to confirm the booking summary, and refreshes availability after a `409` conflict.
- Separates pending, upcoming, and past bookings, exports calendar events as `.ics`, and allows password changes through `PUT /api/auth/password`.
- Filters rooms by type, text, and minimum capacity; admins can view a date-filtered room-by-room daily schedule.
- Shows an admin panel to review bookings and manage active rooms through the `/api/admin/*` endpoints when signed in as an admin.
- Displays backend errors, including unavailable rooms and overlapping booking times.

Room prices and availability are not included in the backend API response, so the interface does not claim a price or availability before the booking request is checked by the server.

## Deployment

On Vercel, select the **Create React App** preset. The build command is `npm run build` and the output directory is `build`. Set `REACT_APP_API_BASE_URL` only when using a backend other than the default.

New registrations are members. To use the admin panel, sign in with an account whose backend role is `admin`; see the backend README for admin account setup.

Configure the backend's `ALLOWED_ORIGINS` environment variable with the exact deployed frontend origin (scheme and hostname, no path or trailing slash). The backend allows local React development origins by default.

# Travels Backend

Backend application for the Travels/GetHotels project. This service uses Next.js server routes, TypeScript, Prisma, authentication, background workers, file uploads, mail utilities, and socket support.

## Requirements

- Node.js 20 or newer
- npm
- Database connection configured in `.env`

## Getting Started

Install dependencies:

```bash
npm install
```

Create the local environment file:

```bash
cp .env.example .env
```

Update `.env` with database, authentication, storage, mail, payment, and other service credentials used by the backend.

Run the development server:

```bash
npm run dev
```

Run the socket server when needed:

```bash
npm run socket
```

Seed the database when needed:

```bash
npm run seed
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run seed
npm run socket
```

## Project Structure

```text
app/          Next.js backend routes
controllers/  Request handlers and controller logic
emails/       Email templates and helpers
lib/          Shared backend utilities
middleware/   Request middleware
modules/      Feature modules
prisma/       Prisma schema, migrations, and seed logic
services/     Service layer integrations
src/          Backend source entry points and support code
tests/        Test files
types/        TypeScript types
uploads/      Local upload storage
utils/        Helper functions
validators/  Validation schemas
workers/      Background job workers
```

## Git Notes

Local environment files, logs, uploads, dependencies, generated files, and build output are ignored through `.gitignore`.

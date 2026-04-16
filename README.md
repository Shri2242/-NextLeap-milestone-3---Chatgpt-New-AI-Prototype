This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

To connect Supabase, create a `.env.local` file in the project root with:

```env
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
RAPIDAPI_KEY=your-rapidapi-key
```

- `SUPABASE_URL`: your Supabase project URL, found in Supabase Settings > API.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-side service role key from Supabase Settings > API.

Then restart the Next.js dev server.

### Firebase Authentication
Add these env vars to your `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account", ...}
```

- `NEXT_PUBLIC_FIREBASE_*` values come from Firebase Console > Project settings.
- `FIREBASE_SERVICE_ACCOUNT_KEY` should contain the JSON service account credentials (stringified). Keep this secret server-side only.

### Security Notes
- Chat supports both guest and logged-in usage.
- Firebase login remains optional from the user icon.
- Keep `.env.local` out of version control.
- For production, set the same env vars in your hosting provider, not in the repo.

### ✅ Supabase Connection Status
- Database schema applied
- API endpoints tested and working
- Environment variables configured
- Firebase authentication enabled
- Ready for deployment

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

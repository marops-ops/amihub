// Server Component wrapper. The "dynamic" export only takes effect here —
// Next.js ignores it in files marked "use client", which is why this page
// is split from LoginForm.tsx (the actual interactive form).
export const dynamic = "force-dynamic";

import LoginForm from "./LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}

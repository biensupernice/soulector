import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { AdminLogin } from "@/client/AdminScreen/AdminLogin";
import { AdminScreen } from "@/client/AdminScreen/AdminScreen";
import {
  clearAdminAuth,
  getStoredAdminAuth,
} from "@/client/AdminScreen/adminAuth";

export default function Admin() {
  // Read after mount: sessionStorage doesn't exist during the server render,
  // and starting as "signed out" would flash the form for anyone signed in.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    setSignedIn(!!getStoredAdminAuth());
  }, []);

  const handleSignOut = useCallback(() => {
    clearAdminAuth();
    setSignedIn(false);
  }, []);

  return (
    <>
      <Head>
        <title>Soulector Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="h-full min-h-screen w-full bg-white text-gray-900">
        {signedIn === null ? null : signedIn ? (
          <AdminScreen onSignOut={handleSignOut} />
        ) : (
          <AdminLogin onSignedIn={() => setSignedIn(true)} />
        )}
      </div>
    </>
  );
}

import { FormEvent, useState } from "react";
import { encodeAdminAuth, storeAdminAuth, verifyAdminAuth } from "./adminAuth";

export function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);

    const encoded = encodeAdminAuth(username, password);
    try {
      if (await verifyAdminAuth(encoded)) {
        storeAdminAuth(encoded);
        onSignedIn();
      } else {
        setError("Those credentials didn't work.");
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-gray-200 p-6"
      >
        <div>
          <h1 className="text-xl font-bold">Soulector Admin</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in with the internal credentials.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Username</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Password</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={checking || !username || !password}
          className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          {checking ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

import Head from "next/head";

export default function Home() {
  return (
    <div className="flex justify-center items-center h-screen">
      <Head>
        <title>Soulector</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex align-center justify-center">
        <h1 className="text-7xl font-bold">Soulector v2</h1>
      </main>
    </div>
  );
}

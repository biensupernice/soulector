import { AppProps } from "next/dist/shared/lib/router/router";
import ReactGA from "react-ga";
import "@reach/slider/styles.css";
import "../styles/globals.css";

import { useRouter } from "next/router";
import { useEffect } from "react";
import Head from "next/head";

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    ReactGA.initialize("UA-175428550-1");
  }, []);

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      ReactGA.pageview(url);
    };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <title>Soulector</title>

        <link rel="manifest" href="/manifest.json" />
        <link
          href="/icons/favicon-16x16.png"
          rel="icon"
          type="image/png"
          sizes="16x16"
        />
        <link
          href="/icons/favicon-32x32.png"
          rel="icon"
          type="image/png"
          sizes="32x32"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png"></link>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#000000" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;

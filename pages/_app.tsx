import { AppProps } from "next/dist/shared/lib/router/router";
import ReactGA from "react-ga";
import "@reach/slider/styles.css";
import "../styles/globals.css";

import { useRouter } from "next/router";
import { useEffect } from "react";

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

  return <Component {...pageProps} />;
}

export default MyApp;

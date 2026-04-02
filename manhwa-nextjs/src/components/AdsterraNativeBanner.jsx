'use client';

import Script from 'next/script';

const AD_CONTAINER_ID = 'container-72b3b145adb1b54525609f8133622419';

export default function AdsterraNativeBanner() {
  return (
    <>
      <div id={AD_CONTAINER_ID} />
      <Script
        id="adsterra-native-banner"
        src="https://landslidegraphsystems.com/72b3b145adb1b54525609f8133622419/invoke.js"
        strategy="afterInteractive"
        data-cfasync="false"
      />
    </>
  );
}

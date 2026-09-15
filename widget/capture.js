(function () {
  "use strict";

  const SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024;
  const SCREENSHOT_SCALE_STEP = 0.8;
  const SCREENSHOT_MIN_SCALE = 0.28;

  function pad(value, length) {
    return String(value).padStart(length, "0");
  }

  // serwer nie odtworzy strefy klienta wiec przesuniecie musi przyjsc w zgloszeniu
  function toLocalIsoString(date) {
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes < 0 ? "-" : "+";
    const absolute = Math.abs(offsetMinutes);

    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}` +
      `T${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}` +
      `.${pad(date.getMilliseconds(), 3)}` +
      `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`
    );
  }

  function collectMetadata() {
    const root = document.documentElement;

    return {
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      reportedAt: toLocalIsoString(new Date()),
      viewport: {
        width: root.clientWidth,
        height: root.clientHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
      language: navigator.language || null,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    };
  }

  function isWidgetNode(node) {
    return node.nodeType === 1 && node.classList.contains("bugshot-widget");
  }

  // ukrycie panelu nie wystarcza bo foreignObject serializuje takze niewidoczne poddrzewo
  function keepNode(node) {
    return !isWidgetNode(node);
  }

  // transform na korzeniu tworzy blok zawierajacy dla fixed wiec przypinamy je do dokumentu
  function pinFixedElements(scrollX, scrollY) {
    const touched = [];

    document.querySelectorAll("*").forEach((element) => {
      if (window.getComputedStyle(element).position !== "fixed") return;
      if (element.closest(".bugshot-widget")) return;

      const rect = element.getBoundingClientRect();

      touched.push([element, element.getAttribute("style")]);
      element.style.position = "absolute";
      element.style.top = `${rect.top + scrollY}px`;
      element.style.left = `${rect.left + scrollX}px`;
      element.style.right = "auto";
      element.style.bottom = "auto";
    });

    return function restore() {
      touched.forEach(([element, style]) => {
        if (style === null) {
          element.removeAttribute("style");
        } else {
          element.setAttribute("style", style);
        }
      });
    };
  }

  function toPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("canvas encoding returned no blob"));
        }
      }, "image/png");
    });
  }

  function rescale(canvas, scale) {
    const target = document.createElement("canvas");

    target.width = Math.max(1, Math.round(canvas.width * scale));
    target.height = Math.max(1, Math.round(canvas.height * scale));
    target.getContext("2d").drawImage(canvas, 0, 0, target.width, target.height);

    return target;
  }

  // tlo strony siedzi zwykle na body a jego pudelko konczy sie na tresci wiec krotka strona
  // dostaje biala rame ponizej zawartosci zamiast koloru ktory widzi uzytkownik
  function pageBackground() {
    const transparent = /^(transparent|rgba\(0, 0, 0, 0\))$/;
    const root = window.getComputedStyle(document.documentElement).backgroundColor;
    if (!transparent.test(root)) return root;

    const body = window.getComputedStyle(document.body).backgroundColor;
    if (!transparent.test(body)) return body;

    return "#ffffff";
  }

  // korzeniem jest documentElement bo na body modern renderery gubia wyzerowany margines
  // a tlo malowane na html ucieka razem z transformem i krawedzie zrzutu wychodza biale
  async function renderViewport() {
    const root = document.documentElement;
    const width = root.clientWidth;
    const height = root.clientHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const maskState = window.BUGSHOT_MASK.prepare();
    const restore = pinFixedElements(scrollX, scrollY);

    try {
      const canvas = await window.htmlToImage.toCanvas(root, {
        width,
        height,
        pixelRatio: 1,
        backgroundColor: pageBackground(),
        filter: keepNode,
        style: {
          transform: `translate(${-scrollX}px, ${-scrollY}px)`,
          transformOrigin: "top left",
          margin: "0",
        },
      });

      window.BUGSHOT_MASK.apply(canvas, maskState);
      return canvas;
    } finally {
      restore();
    }
  }

  async function captureScreenshot() {
    const canvas = await renderViewport();

    let scale = 1;
    let sized = canvas;
    let blob = await toPngBlob(canvas);

    // pixelRatio 1 zbija wage kilkukrotnie a reszte dobija skalowanie bo AC wymaga PNG
    while (
      blob.size > SCREENSHOT_MAX_BYTES &&
      scale * SCREENSHOT_SCALE_STEP >= SCREENSHOT_MIN_SCALE
    ) {
      scale *= SCREENSHOT_SCALE_STEP;
      sized = rescale(canvas, scale);
      blob = await toPngBlob(sized);
    }

    // AC nie dopuszcza zrzutu ponad limit wiec zamiast wyslac za duzy oddajemy zgloszenie bez niego
    if (blob.size > SCREENSHOT_MAX_BYTES) {
      throw new Error(
        `screenshot still ${blob.size} bytes at minimum scale ${SCREENSHOT_MIN_SCALE}`
      );
    }

    return {
      file: new File([blob], "screenshot.png", { type: "image/png" }),
      width: sized.width,
      height: sized.height,
      bytes: blob.size,
      scale,
      mask: window.BUGSHOT_MASK.last,
    };
  }

  const api = {
    metadata: null,
    screenshot: null,
    screenshotError: null,
    pending: null,

    // wolane przy otwarciu panelu i przy nowym zgloszeniu wiec bez interakcji uzytkownika
    collect() {
      api.metadata = collectMetadata();
      api.screenshot = null;
      api.screenshotError = null;

      // zgloszenie bez zrzutu jest dalej uzyteczne wiec blad tutaj nie moze przerwac wysylki
      api.pending = captureScreenshot().then(
        (result) => {
          api.screenshot = result;
        },
        (error) => {
          api.screenshotError = describeError(error);
        }
      );

      return api.metadata;
    },

    async screenshotFile() {
      await api.pending;
      return api.screenshot ? api.screenshot.file : null;
    },

    payload() {
      const metadata = api.metadata || api.collect();
      const { width, height } = metadata.viewport;

      return {
        pageUrl: metadata.pageUrl,
        userAgent: metadata.userAgent,
        reportedAt: metadata.reportedAt,
        // ukryta ramka potrafi zglosic zerowy rozmiar ktory niczego nie mowi
        viewport: width > 0 && height > 0 ? metadata.viewport : null,
        language: metadata.language,
        timeZone: metadata.timeZone,
      };
    },
  };

  window.BUGSHOT_CAPTURE = api;
})();

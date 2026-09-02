(function () {
  "use strict";

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
    };
  }

  const api = {
    metadata: null,

    // wolane przy otwarciu panelu i przy nowym zgloszeniu wiec bez interakcji uzytkownika
    collect() {
      api.metadata = collectMetadata();
      return api.metadata;
    },

    // POST /tickets przyjmuje tylko te trzy pola a reszta snapshotu jest do wgladu
    payload() {
      const metadata = api.metadata || api.collect();

      return {
        pageUrl: metadata.pageUrl,
        userAgent: metadata.userAgent,
        reportedAt: metadata.reportedAt,
      };
    },
  };

  window.BUGSHOT_CAPTURE = api;
})();

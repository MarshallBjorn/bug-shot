(function () {
  "use strict";

  const MARK = "data-bugshot-masked";
  const DEFAULT_MODE = "blur";

  // widget siedzi na cudzej stronie wiec wykrywanie musi dzialac bez markupu od gospodarza
  const DEFAULT_PATTERNS = [
    "\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b",
    "\\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\\b",
    "\\b[A-Z]{2}\\d{2}[A-Z0-9]{10,30}\\b",
    "\\b(?:\\d[ -]?){13,19}\\b",
    "\\b\\d{11}\\b",
    "\\b[\\w.+-]+@[\\w-]+\\.[\\w.-]{2,}\\b",
    "(?:\\+48[\\s-]?)?(?:\\d{3}[\\s-]?){3}\\b",
    "\\b[A-Z]{3}\\s?\\d{6}\\b",
  ];

  const DEFAULT_SELECTORS = ["[data-bugshot-mask]"];

  const SENSITIVE_AUTOCOMPLETE =
    /^(cc-|current-password|new-password|one-time-code|tel|email)/i;

  const invalid = { patterns: [], selectors: [] };

  // zly wzorzec z configu hosta nie moze wywalic calego maskowania
  function compile(sources) {
    const compiled = [];

    sources.forEach((source) => {
      try {
        compiled.push(new RegExp(source instanceof RegExp ? source.source : source, "g"));
      } catch {
        invalid.patterns.push(String(source));
      }
    });

    return compiled;
  }

  function settings() {
    const config = (window.BUGSHOT_CONFIG && window.BUGSHOT_CONFIG.mask) || {};
    const useDefaults = config.useDefaults !== false;

    invalid.patterns = [];
    invalid.selectors = [];

    return {
      mode: config.mode || DEFAULT_MODE,
      selectors: (useDefaults ? DEFAULT_SELECTORS : []).concat(config.selectors || []),
      patterns: compile((useDefaults ? DEFAULT_PATTERNS : []).concat(config.patterns || [])),
    };
  }

  // strona gospodarza nie moze zostac zamaskowana na stale wiec jeden blad nie przerywa reszty
  function runAll(steps) {
    const failed = [];

    steps.forEach((step) => {
      try {
        step();
      } catch (error) {
        failed.push(String(error && error.message ? error.message : error));
      }
    });

    if (api.last) api.last.restoreErrors = failed;
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
  }

  function inWidget(element) {
    return !!element.closest(".bugshot-widget");
  }

  function matches(patterns, text) {
    return patterns.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    });
  }

  // zaslaniamy caly element a nie sam dopasowany fragment bo tak zostalo sprawdzone w spike
  function detect(config) {
    const found = [];
    const seen = new Set();

    function push(element, reason) {
      if (!element || seen.has(element)) return;
      if (inWidget(element) || !isVisible(element)) return;

      seen.add(element);
      found.push({ element, reason });
    }

    config.selectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((element) => push(element, selector));
      } catch {
        invalid.selectors.push(String(selector));
      }
    });

    document.querySelectorAll("input, textarea").forEach((element) => {
      if (element.type === "password") return push(element, "input[type=password]");

      const autocomplete = element.getAttribute("autocomplete") || "";
      if (SENSITIVE_AUTOCOMPLETE.test(autocomplete)) {
        return push(element, `autocomplete=${autocomplete}`);
      }

      if (element.value && matches(config.patterns, element.value)) {
        push(element, "input value");
      }
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;

        const parent = node.parentElement;
        if (!parent || inWidget(parent)) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script, style, title")) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      if (matches(config.patterns, node.nodeValue)) push(node.parentElement, "text");
    }

    return found;
  }

  function styleSheet(mode) {
    if (mode === "blur") {
      return `[${MARK}]{filter:blur(7px)!important}`;
    }

    return (
      `[${MARK}]{background:#111!important;color:transparent!important;text-shadow:none!important}` +
      `[${MARK}] *{color:transparent!important;background:transparent!important}`
    );
  }

  // warstwa CSS nie rusza tresci wiec przywrocenie to zdjecie atrybutu i stylu
  function applyStyle(targets, mode) {
    targets.forEach(({ element }) => element.setAttribute(MARK, ""));

    const style = document.createElement("style");
    style.textContent = styleSheet(mode);
    document.head.appendChild(style);

    return function restore() {
      runAll(
        targets
          .map(({ element }) => () => element.removeAttribute(MARK))
          .concat(() => style.remove())
      );
    };
  }

  // podmieniamy wartosci wezlow tekstowych a nie innerHTML bo to zrywa listenery hosta
  function applyDots(targets) {
    const undo = [];

    targets.forEach(({ element }) => {
      if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        const was = element.value;

        undo.push(() => {
          element.value = was;
        });
        element.value = "•".repeat(Math.min(was.length || 8, 24));
        return;
      }

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let next;

      while ((next = walker.nextNode())) {
        const node = next;
        const was = node.nodeValue;

        undo.push(() => {
          node.nodeValue = was;
        });
        node.nodeValue = was.replace(/\S/g, "•");
      }
    });

    return function restore() {
      runAll(undo);
    };
  }

  const api = {
    last: null,

    // wolane tuz przed zrzutem a restore zaraz po nim
    apply() {
      const config = settings();

      if (config.mode === "off") {
        api.last = { mode: "off", masked: 0, invalidPatterns: [], invalidSelectors: [] };
        return function restore() {};
      }

      const targets = detect(config);
      const restore =
        config.mode === "dots" ? applyDots(targets) : applyStyle(targets, config.mode);

      api.last = {
        mode: config.mode,
        masked: targets.length,
        reasons: targets.map((target) => target.reason),
        invalidPatterns: invalid.patterns.slice(),
        invalidSelectors: invalid.selectors.slice(),
      };

      return restore;
    },
  };

  window.BUGSHOT_MASK = api;
})();

(function () {
  "use strict";

  const DEFAULT_MODE = "blur";
  const DEFAULT_BLUR_PX = 7;

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

  const invalid = {
    patterns: [],
    selectors: [],
  };

  function compile(sources) {
    const compiled = [];

    sources.forEach((source) => {
      try {
        compiled.push(
          new RegExp(
            source instanceof RegExp ? source.source : source,
            "g"
          )
        );
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
      selectors: (useDefaults ? DEFAULT_SELECTORS : []).concat(
        config.selectors || []
      ),
      patterns: compile(
        (useDefaults ? DEFAULT_PATTERNS : []).concat(config.patterns || [])
      ),
    };
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    const style = window.getComputedStyle(element);

    return (
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      style.opacity !== "0"
    );
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

  function detect(config) {
    const found = [];
    const seen = new Set();

    function push(element, reason) {
      if (!element || seen.has(element)) return;
      if (inWidget(element) || !isVisible(element)) return;

      const rect = element.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      seen.add(element);

      found.push({
        element,
        reason,
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
    }

    config.selectors.forEach((selector) => {
      try {
        document
          .querySelectorAll(selector)
          .forEach((element) => push(element, selector));
      } catch {
        invalid.selectors.push(String(selector));
      }
    });

    document.querySelectorAll("input, textarea").forEach((element) => {
      if (element.type === "password") {
        push(element, "input[type=password]");
        return;
      }

      const autocomplete = element.getAttribute("autocomplete") || "";

      if (SENSITIVE_AUTOCOMPLETE.test(autocomplete)) {
        push(element, `autocomplete=${autocomplete}`);
        return;
      }

      if (element.value && matches(config.patterns, element.value)) {
        push(element, "input value");
      }
    });

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          const parent = node.parentElement;

          if (!parent || inWidget(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          if (parent.closest("script, style, title")) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let node;

    while ((node = walker.nextNode())) {
      if (matches(config.patterns, node.nodeValue)) {
        push(node.parentElement, "text");
      }
    }

    return found;
  }

  function clipRect(rect, canvas) {
    const left = Math.max(0, Math.floor(rect.left));
    const top = Math.max(0, Math.floor(rect.top));
    const right = Math.min(
      canvas.width,
      Math.ceil(rect.left + rect.width)
    );
    const bottom = Math.min(
      canvas.height,
      Math.ceil(rect.top + rect.height)
    );

    if (right <= left || bottom <= top) {
      return null;
    }

    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
    };
  }

  function applyBlur(canvas, rect) {
    const padding = DEFAULT_BLUR_PX * 3;

    const sourceLeft = Math.max(0, rect.left - padding);
    const sourceTop = Math.max(0, rect.top - padding);
    const sourceRight = Math.min(
      canvas.width,
      rect.left + rect.width + padding
    );
    const sourceBottom = Math.min(
      canvas.height,
      rect.top + rect.height + padding
    );

    const sourceWidth = sourceRight - sourceLeft;
    const sourceHeight = sourceBottom - sourceTop;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return;
    }

    const temp = document.createElement("canvas");
    temp.width = sourceWidth;
    temp.height = sourceHeight;

    const tempContext = temp.getContext("2d");

    if (!tempContext) {
      return;
    }

    tempContext.filter = `blur(${DEFAULT_BLUR_PX}px)`;
    tempContext.drawImage(
      canvas,
      sourceLeft,
      sourceTop,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight
    );

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.drawImage(
      temp,
      rect.left - sourceLeft,
      rect.top - sourceTop,
      rect.width,
      rect.height,
      rect.left,
      rect.top,
      rect.width,
      rect.height
    );
  }

  function applyCover(canvas, rect) {
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.save();
    context.fillStyle = "#111";
    context.fillRect(
      rect.left,
      rect.top,
      rect.width,
      rect.height
    );
    context.restore();
  }

  function applyDots(canvas, rect) {
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.save();

    context.fillStyle = "#111";
    context.fillRect(
      rect.left,
      rect.top,
      rect.width,
      rect.height
    );

    context.fillStyle = "#fff";
    context.font = `${Math.max(12, Math.min(18, rect.height * 0.6))}px sans-serif`;
    context.textBaseline = "middle";

    const dots = "•".repeat(
      Math.max(1, Math.floor(rect.width / 10))
    );

    context.fillText(
      dots,
      rect.left + 4,
      rect.top + rect.height / 2
    );

    context.restore();
  }

  function applyTarget(canvas, target, mode) {
    const rect = clipRect(target.rect, canvas);

    if (!rect) {
      return;
    }

    if (mode === "cover") {
      applyCover(canvas, rect);
      return;
    }

    if (mode === "dots") {
      applyDots(canvas, rect);
      return;
    }

    applyBlur(canvas, rect);
  }

  const api = {
    last: null,

    prepare() {
      const config = settings();

      if (config.mode === "off") {
        api.last = {
          mode: "off",
          masked: 0,
          reasons: [],
          invalidPatterns: [],
          invalidSelectors: [],
        };

        return {
          mode: "off",
          targets: [],
        };
      }

      const targets = detect(config);

      api.last = {
        mode: config.mode,
        masked: targets.length,
        reasons: targets.map((target) => target.reason),
        invalidPatterns: invalid.patterns.slice(),
        invalidSelectors: invalid.selectors.slice(),
      };

      return {
        mode: config.mode,
        targets,
      };
    },

    apply(canvas, state) {
      if (!canvas || !state || state.mode === "off") {
        return;
      }

      state.targets.forEach((target) => {
        try {
          applyTarget(canvas, target, state.mode);
        } catch {
          // Jeden problem z pojedynczym obszarem nie może przerwać całego capture.
        }
      });
    },
  };

  window.BUGSHOT_MASK = api;
})();

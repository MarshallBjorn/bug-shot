(function () {
  "use strict";

  const API_BASE_URL = window.BUGSHOT_CONFIG.apiBaseUrl;

  const MAX_LOG_BYTES = 256 * 1024;
  const MAX_ENTRY_BYTES = 32 * 1024;
  const REQUEST_TIMEOUT_MS = 10000;
  const RETRY_DELAY_MS = 250;

  const diagnosticLogs = [];
  const textEncoder = new TextEncoder();
  let diagnosticLogBytes = 0;

  const originalConsole = {
    debug: console.debug,
    info: console.info,
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  function safeStringify(value) {
    if (value instanceof Error) {
      return JSON.stringify({
        name: value.name,
        message: value.message,
        stack: value.stack || null,
      });
    }

    if (typeof value === "string") {
      return value;
    }

    if (
      value === null ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint" ||
      typeof value === "undefined" ||
      typeof value === "function" ||
      typeof value === "symbol"
    ) {
      return String(value);
    }

    try {
      const ancestors = [];

      return JSON.stringify(value, function (key, nestedValue) {
        while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
          ancestors.pop();
        }

        if (typeof nestedValue === "object" && nestedValue !== null) {
          if (ancestors.includes(nestedValue)) {
            return "[Circular]";
          }

          ancestors.push(nestedValue);
        }

        if (typeof nestedValue === "bigint") {
          return String(nestedValue);
        }

        if (typeof nestedValue === "function") {
          return `[Function ${nestedValue.name || "anonymous"}]`;
        }

        if (typeof nestedValue === "symbol") {
          return String(nestedValue);
        }

        return nestedValue;
      });
    } catch {
      return String(value);
    }
  }

  function formatConsoleArgs(args) {
    return args.map(safeStringify).join(" ");
  }

  function truncateToUtf8Bytes(text, maxBytes) {
    if (textEncoder.encode(text).length <= maxBytes) {
      return text;
    }

    let result = text;
    let low = 0;
    let high = text.length;

    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      const candidate = text.slice(0, middle);

      if (textEncoder.encode(`${candidate} [truncated]`).length <= maxBytes) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    result = text.slice(0, low);

    return `${result} [truncated]`;
  }

  function formatDiagnosticEntry(entry) {
    return `[${entry.timestamp}] ${entry.level} ${entry.source}: ${entry.message}`;
  }

  function entrySize(entry) {
    return textEncoder.encode(formatDiagnosticEntry(entry) + "\n").length;
  }

  function trimDiagnosticLogs() {
    while (diagnosticLogBytes > MAX_LOG_BYTES) {
      const removableIndex = diagnosticLogs.findIndex(
        (entry) => entry.level === "INFO"
      );

      if (removableIndex !== -1) {
        const [removed] = diagnosticLogs.splice(removableIndex, 1);
        diagnosticLogBytes -= entrySize(removed);
        continue;
      }

      const oldestIndex = 0;
      const [removed] = diagnosticLogs.splice(oldestIndex, 1);
      diagnosticLogBytes -= entrySize(removed);
    }
  }

  function clearDiagnosticLogs() {
    diagnosticLogs.length = 0;
    diagnosticLogBytes = 0;
  }

  function addDiagnosticLog(level, source, message) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message: truncateToUtf8Bytes(String(message), MAX_ENTRY_BYTES),
    };

    diagnosticLogs.push(entry);
    diagnosticLogBytes += entrySize(entry);
    trimDiagnosticLogs();
  }

  const widget = document.querySelector(".bugshot-widget");
  if (!widget) return;

  console.debug = function (...args) {
    addDiagnosticLog("DEBUG", "console.debug", formatConsoleArgs(args));
    Reflect.apply(originalConsole.debug, console, args);
  };

  console.info = function (...args) {
    addDiagnosticLog("INFO", "console.info", formatConsoleArgs(args));
    Reflect.apply(originalConsole.info, console, args);
  };

  console.log = function (...args) {
    addDiagnosticLog("INFO", "console.log", formatConsoleArgs(args));
    Reflect.apply(originalConsole.log, console, args);
  };

  console.warn = function (...args) {
    addDiagnosticLog("WARN", "console.warn", formatConsoleArgs(args));
    Reflect.apply(originalConsole.warn, console, args);
  };

  console.error = function (...args) {
    addDiagnosticLog("ERROR", "console.error", formatConsoleArgs(args));
    Reflect.apply(originalConsole.error, console, args);
  };

  window.addEventListener("error", function (event) {
    const details = [
      event.message || "Unknown error",
      event.filename ? `source=${event.filename}` : "",
      event.lineno ? `line=${event.lineno}` : "",
      event.colno ? `column=${event.colno}` : "",
      event.error instanceof Error && event.error.stack
        ? `stack=${event.error.stack}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");

    addDiagnosticLog("ERROR", "window.onerror", details);
  });

  window.addEventListener("unhandledrejection", function (event) {
    const reason = event.reason;

    addDiagnosticLog(
      "ERROR",
      "window.unhandledrejection",
      safeStringify(reason)
    );
  });

  function getDiagnosticLogsText() {
    return diagnosticLogs.map(formatDiagnosticEntry).join("\n");
  }

  const openButton = widget.querySelector(".bugshot-fab");
  const panel = widget.querySelector(".bugshot-panel");
  const closeButton = widget.querySelector(".bugshot-close");
  const cancelButton = widget.querySelector(".bugshot-actions .bugshot-secondary");
  const form = widget.querySelector(".bugshot-form");
  const textarea = widget.querySelector("#bugshot-description");
  const submitButton = widget.querySelector(".bugshot-submit");
  const status = widget.querySelector(".bugshot-status");
  const count = widget.querySelector(".bugshot-count");
  const attachmentDropzone = widget.querySelector(".bugshot-attachment");
  const fileInput = widget.querySelector("#bugshot-files");
  const fileList = widget.querySelector(".bugshot-file-list");
  const successView = widget.querySelector(".bugshot-success-view");
  const successNewButton = widget.querySelector(".bugshot-success-new");
  const successCloseButton = widget.querySelector(".bugshot-success-close");

  const successTicketId = widget.querySelector(
    ".bugshot-success-ticket code"
  );

  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_TOTAL_FILE_SIZE = MAX_FILES * MAX_FILE_SIZE;
  const MAX_DESCRIPTION_LENGTH = 1200;
  const ACCEPTED_IMAGE_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
  ]);

  let selectedFiles = [];
  let objectUrls = [];
  let lastFocus = openButton;
  let state = "closed";
  let sendTimer = null;

  function setState(nextState) {
    state = nextState;
    widget.dataset.state = nextState;
    openButton.hidden = nextState !== "closed";
    openButton.setAttribute("aria-expanded", nextState === "closed" ? "false" : "true");
    if (nextState === "sending") {
      widget.setAttribute("aria-busy", "true");
    } else {
      widget.removeAttribute("aria-busy");
    }
  }

  function setStatus(message, tone) {
    status.textContent = message;
    if (tone) {
      status.dataset.tone = tone;
    } else {
      delete status.dataset.tone;
    }
  }

  function updateFormState() {
    const rawLength = textarea.value.length;
    const trimmedLength = textarea.value.trim().length;
    count.textContent = `${rawLength}/${MAX_DESCRIPTION_LENGTH}`;
    submitButton.disabled = trimmedLength === 0 || state === "sending";
  }

  function revokeObjectUrls() {
    for (const url of objectUrls) {
      URL.revokeObjectURL(url);
    }
    objectUrls = [];
  }

  function revokeAndClearFiles() {
    selectedFiles = [];
    fileInput.value = "";
    revokeObjectUrls();
    fileList.replaceChildren();
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function pluralizeAttachments(count) {
    if (count === 1) return "załącznik";
    if (count >= 2 && count <= 4) return "załączniki";
    return "załączników";
  }

  function attachmentCountMessage(count) {
    return `Wybrano ${count} ${pluralizeAttachments(count)}.`;
  }

  function showFormView() {
    form.hidden = false;
    successView.hidden = true;
  }

  function showSuccessView(ticketId) {
    form.hidden = true;
    successView.hidden = false;
    successTicketId.textContent = ticketId;
    setState("success");
    panel.scrollTop = 0;
    successNewButton.focus();
  }

  function clearSubmissionState() {
    if (sendTimer) {
      window.clearTimeout(sendTimer);
      sendTimer = null;
    }
  }

  function resetForm({ focus = true } = {}) {
    window.BUGSHOT_CAPTURE.collect();
    clearSubmissionState();
    textarea.value = "";
    revokeAndClearFiles();
    showFormView();
    setStatus("", "");
    setState("open");
    updateFormState();

    if (focus) {
      textarea.focus();
    }
  }

  function closePanel() {
    clearSubmissionState();
    textarea.value = "";
    revokeAndClearFiles();
    panel.hidden = true;
    showFormView();
    setStatus("", "");
    setState("closed");
    updateFormState();

    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  function openPanel() {
    window.BUGSHOT_CAPTURE.collect();

    lastFocus =
      document.activeElement && document.activeElement !== document.body
        ? document.activeElement
        : openButton;

    panel.hidden = false;
    showFormView();
    setStatus("", "");
    setState("open");
    updateFormState();
    textarea.focus();
  }

  function renderFiles() {
    revokeObjectUrls();
    fileList.replaceChildren();

    selectedFiles.forEach((file, index) => {
      const row = document.createElement("div");
      row.className = "bugshot-file";

      const preview = document.createElement("img");
      preview.className = "bugshot-file-preview";
      preview.alt = "";
      preview.decoding = "async";

      const objectUrl = URL.createObjectURL(file);
      objectUrls.push(objectUrl);
      preview.src = objectUrl;

      const text = document.createElement("div");

      const name = document.createElement("span");
      name.className = "bugshot-file-name";
      name.textContent = file.name;

      const meta = document.createElement("span");
      meta.className = "bugshot-file-meta";
      meta.textContent = `${formatFileSize(file.size)} · lokalny załącznik`;

      text.append(name, meta);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "bugshot-file-remove";
      remove.setAttribute("aria-label", `Usuń załącznik ${file.name}`);
      remove.textContent = "×";

      remove.addEventListener("click", function () {
        if (state === "sending" || state === "success") return;

        selectedFiles.splice(index, 1);
        renderFiles();
        updateFormState();

        if (selectedFiles.length === 0) {
          setStatus("", "");
        } else {
          setStatus(attachmentCountMessage(selectedFiles.length), "");
        }
      });

      row.append(preview, text, remove);
      fileList.append(row);
    });
  }

  function fileKey(file) {
    return `${file.name}|${file.size}|${file.lastModified}|${file.type}`;
  }

  function addFiles(fileCollection) {
    if (state === "sending" || state === "success") return;

    const incomingFiles = Array.from(fileCollection || []);
    if (!incomingFiles.length) return;

    const existingKeys = new Set(selectedFiles.map(fileKey));
    const newCandidates = [];
    let unsupportedCount = 0;
    let oversizedCount = 0;
    let duplicateCount = 0;

    for (const file of incomingFiles) {
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        unsupportedCount += 1;
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        oversizedCount += 1;
        continue;
      }

      const key = fileKey(file);
      if (existingKeys.has(key) || newCandidates.some((candidate) => fileKey(candidate) === key)) {
        duplicateCount += 1;
        continue;
      }

      newCandidates.push(file);
    }

    const availableSlots = Math.max(0, MAX_FILES - selectedFiles.length);
    const accepted = newCandidates.slice(0, availableSlots);
    const limitedCount = Math.max(0, newCandidates.length - accepted.length);
    const projectedTotalSize =
      selectedFiles.reduce((sum, file) => sum + file.size, 0) +
      accepted.reduce((sum, file) => sum + file.size, 0);

    if (projectedTotalSize > MAX_TOTAL_FILE_SIZE) {
      let totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
      const sizeAccepted = [];

      for (const file of accepted) {
        if (totalSize + file.size <= MAX_TOTAL_FILE_SIZE) {
          sizeAccepted.push(file);
          totalSize += file.size;
        } else {
          oversizedCount += 1;
        }
      }

      accepted.splice(0, accepted.length, ...sizeAccepted);
    }

    if (accepted.length > 0) {
      selectedFiles = [...selectedFiles, ...accepted];
      setState("open");
      showFormView();
      renderFiles();
      updateFormState();
    }

    const messages = [];

    if (unsupportedCount > 0) {
      const unsupportedLabel =
        unsupportedCount === 1 ? "plik" : unsupportedCount >= 2 && unsupportedCount <= 4 ? "pliki" : "plików";
      messages.push(
        `Pominięto ${unsupportedCount} ${unsupportedLabel} w nieobsługiwanym formacie. Dozwolone są PNG, JPEG, WebP i GIF.`
      );
    }

    if (oversizedCount > 0) {
      const oversizedLabel =
        oversizedCount === 1
          ? "załącznika"
          : oversizedCount >= 2 && oversizedCount <= 4
            ? "załączniki"
            : "załączników";
      const oversizedVerb = oversizedCount === 1 ? "przekraczającego" : "przekraczających";
      messages.push(
        `Nie dodano ${oversizedCount} ${oversizedLabel} ${oversizedVerb} limit 10 MB na plik.`
      );
    }

    if (limitedCount > 0) {
      const fileLabel =
        limitedCount === 1
          ? "pliku"
          : limitedCount >= 2 && limitedCount <= 4
            ? "plików"
            : "plików";
      messages.push(
        `Można dodać maksymalnie ${MAX_FILES} załączników. Nie dodano ${limitedCount} ${fileLabel}.`
      );
    }

    if (duplicateCount > 0 && messages.length === 0) {
      messages.push(
        duplicateCount === 1
          ? "Ten załącznik został już dodany."
          : `Te załączniki zostały już dodane: ${duplicateCount}.`
      );
    }

    if (messages.length > 0) {
      setStatus(messages.join(" "), "error");
    } else if (selectedFiles.length > 0) {
      setStatus(attachmentCountMessage(selectedFiles.length), "");
    } else {
      setStatus("", "");
    }
  }

  function getFocusableElements() {
    return Array.from(
      panel.querySelectorAll(
        'button:not([disabled]):not([tabindex="-1"]), textarea, [tabindex="0"]'
      )
    ).filter((element) => {
      if (element.hidden || element.closest("[hidden]")) return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function focusTrap(event) {
    if (event.key !== "Tab" || panel.hidden) return;

    const focusable = getFocusableElements();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function fetchWithRetry(url, options, createBody = null) {
    let attempt = 0;

    while (attempt < 2) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      const body = createBody ? createBody() : undefined;

      try {
        const response = await fetch(url, {
          ...options,
          ...(body !== undefined ? { body } : {}),
          signal: controller.signal,
        });

        if (response.status >= 500 && response.status <= 599 && attempt === 0) {
          attempt += 1;
          await new Promise((resolve) =>
            window.setTimeout(resolve, RETRY_DELAY_MS)
          );
          continue;
        }

        return response;
      } catch (error) {
        const shouldRetry =
          attempt === 0 && error?.name === "AbortError";

        if (!shouldRetry) {
          throw error;
        }

        attempt += 1;
        await new Promise((resolve) =>
          window.setTimeout(resolve, RETRY_DELAY_MS)
        );
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

  }

  async function uploadAttachments(ticketId, uploadToken, attachments) {
    const response = await fetchWithRetry(
      `${API_BASE_URL}/api/v1/tickets/${ticketId}/attachments`,
      {
        method: "POST",
        headers: {
          "X-Upload-Token": uploadToken,
        },
      },
      () => {
        const formData = new FormData();

        for (const file of attachments) {
          formData.append("files", file, file.name);
        }

        const logs = getDiagnosticLogsText();
        if (logs) {
          formData.append(
            "consoleLog",
            new Blob([logs], { type: "text/plain;charset=utf-8" }),
            "console.log"
          );
        }

        return formData;
      }
    );

    if (!response.ok) {
      throw new Error(`Attachment upload failed with status ${response.status}.`);
    }

    return response.json();
  }

  async function submitReport({ description, attachments }) {
    const payload = {
      projectKey: "demo",
      description,
      ...window.BUGSHOT_CAPTURE.payload(),
    };

    const response = await fetchWithRetry(
      `${API_BASE_URL}/api/v1/tickets`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
      () => JSON.stringify(payload)
    );

    if (!response.ok) {
      let message = `Request failed with status ${response.status}.`;

      try {
        const errorBody = await response.json();
        message = errorBody?.detail || errorBody?.title || message;
      } catch {
        // Keep the HTTP status message when the response is not JSON.
      }

      throw new Error(message);
    }

    const data = await response.json();

    const reportAttachments = attachments || [];
    const logs = getDiagnosticLogsText();

    if (reportAttachments.length > 0 || logs) {
      await uploadAttachments(
        data.id,
        data.uploadToken,
        reportAttachments
      );
    }

    return {
      accepted: true,
      id: data.id,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (state === "sending" || state === "success") return;

    const description = textarea.value.trim();
    if (!description) {
      setState("error");
      setStatus("Dodaj opis problemu przed wysłaniem.", "error");
      updateFormState();
      textarea.focus();
      return;
    }

    setState("sending");
    updateFormState();
    setStatus("Wysyłanie zgłoszenia…", "");

    try {
      const screenshot = await window.BUGSHOT_CAPTURE.screenshotFile();
      const attachments = screenshot ? [screenshot, ...selectedFiles] : [...selectedFiles];

      const result = await submitReport({
        description,
        attachments,
      });

      if (!result || result.accepted !== true) {
        throw new Error("Submission was not accepted.");
      }

      revokeAndClearFiles();
      textarea.value = "";
      clearDiagnosticLogs();
      setStatus("", "");
      showSuccessView(result.id);
    } catch (error) {
      setState("error");
      setStatus(
        "Nie udało się przyjąć zgłoszenia. Spróbuj ponownie.",
        "error"
      );
      updateFormState();
    }
  }

  openButton.addEventListener("click", openPanel);
  closeButton.addEventListener("click", closePanel);
  cancelButton.addEventListener("click", closePanel);
  successNewButton.addEventListener("click", () => resetForm());
  successCloseButton.addEventListener("click", closePanel);
  form.addEventListener("submit", handleSubmit);

  textarea.addEventListener("input", function () {
    if (state === "error") {
      setState("open");
      setStatus("", "");
    }
    updateFormState();
  });

  attachmentDropzone.addEventListener("click", function () {
    if (state === "sending" || state === "success") return;
    fileInput.click();
  });

  attachmentDropzone.addEventListener("keydown", function (event) {
    if (state === "sending" || state === "success") return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", function () {
    addFiles(fileInput.files);
    fileInput.value = "";
  });

  for (const eventName of ["dragenter", "dragover"]) {
    attachmentDropzone.addEventListener(eventName, function (event) {
      if (state === "sending" || state === "success") return;
      event.preventDefault();
      event.stopPropagation();
      attachmentDropzone.classList.add("is-dragging");
    });
  }

  for (const eventName of ["dragleave", "drop"]) {
    attachmentDropzone.addEventListener(eventName, function (event) {
      if (state === "sending" || state === "success") return;
      event.preventDefault();
      event.stopPropagation();
      attachmentDropzone.classList.remove("is-dragging");
    });
  }

  attachmentDropzone.addEventListener("drop", function (event) {
    if (state === "sending" || state === "success") return;
    addFiles(event.dataTransfer.files);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) {
      closePanel();
      return;
    }
    focusTrap(event);
  });

  revokeAndClearFiles();
  textarea.value = "";
  setState("closed");
  panel.hidden = true;
  showFormView();
  setStatus("", "");
  updateFormState();

  window.addEventListener("pageshow", function () {
    clearSubmissionState();
    revokeAndClearFiles();
    textarea.value = "";
    setState("closed");
    panel.hidden = true;
    showFormView();
    setStatus("", "");
    updateFormState();
  });

  window.addEventListener("beforeunload", function () {
    clearSubmissionState();
    revokeObjectUrls();
  });
})();

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const MAX_INPUT_CHARS = 4000;
const WASM_BASE = chrome.runtime.getURL("node_modules/onnxruntime-web/dist/");

let embedderPromise = null;
let transformersModulePromise = null;

function notifyBackground(type, payload) {
  try {
    chrome.runtime.sendMessage({
      type,
      payload: payload && typeof payload === "object" ? payload : {}
    });
  } catch (_error) {}
}

function toErrorMessage(error) {
  return String(error && error.message ? error.message : error || "Unknown AI runtime error");
}

async function getTransformersModule() {
  if (transformersModulePromise) return transformersModulePromise;

  transformersModulePromise = import(chrome.runtime.getURL("node_modules/@huggingface/transformers/dist/transformers.min.js"))
    .then((mod) => {
      const env = mod && mod.env;
      if (!env || typeof mod.pipeline !== "function") {
        throw new Error("Transformers.js module did not load correctly");
      }

      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = true;
      env.useWasmCache = false;
      env.backends.onnx.wasm.wasmPaths = {
        mjs: `${WASM_BASE}ort-wasm-simd-threaded.asyncify.mjs`,
        wasm: `${WASM_BASE}ort-wasm-simd-threaded.asyncify.wasm`
      };
      return mod;
    })
    .catch((error) => {
      transformersModulePromise = null;
      throw error;
    });

  return transformersModulePromise;
}

function pickDevices() {
  const devices = [];
  if (typeof navigator !== "undefined" && navigator.gpu) {
    devices.push({ device: "webgpu", dtype: "fp32" });
  }
  devices.push({ device: "wasm", dtype: "q8" });
  return devices;
}

async function loadEmbedder() {
  if (embedderPromise) return embedderPromise;

  embedderPromise = (async () => {
    const mod = await getTransformersModule();
    const makePipeline = mod.pipeline;
    let lastError = null;
    for (const candidate of pickDevices()) {
      try {
        const instance = await makePipeline("feature-extraction", MODEL_ID, candidate);
        return {
          instance,
          device: candidate.device,
          dtype: candidate.dtype
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("No supported inference backend was available");
  })().catch((error) => {
    embedderPromise = null;
    throw error;
  });

  return embedderPromise;
}

function sanitizeText(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_INPUT_CHARS);
}

function flattenTensorLike(output) {
  if (!output) return [];
  if (typeof output.tolist === "function") {
    const nested = output.tolist();
    if (Array.isArray(nested) && Array.isArray(nested[0])) return nested[0];
    return Array.isArray(nested) ? nested : [];
  }
  if (Array.isArray(output)) return output;
  if (output.data && typeof output.data.length === "number") return Array.from(output.data);
  return [];
}

async function runEmbeddingSmokeTest(text) {
  const cleaned = sanitizeText(text);
  if (!cleaned) {
    throw new Error("Provide some text before running the embedding smoke test");
  }

  const startedAt = performance.now();
  const runtime = await loadEmbedder();
  const embedding = await runtime.instance(cleaned, {
    pooling: "mean",
    normalize: true
  });
  const vector = flattenTensorLike(embedding);
  if (!vector.length) {
    throw new Error("Embedding pipeline returned an empty vector");
  }

  return {
    ok: true,
    modelId: MODEL_ID,
    backend: runtime.device,
    dtype: runtime.dtype,
    dimensions: vector.length,
    preview: vector.slice(0, 8).map((value) => Number(value).toFixed(6)),
    durationMs: Math.round(performance.now() - startedAt),
    inputChars: cleaned.length
  };
}

const runtimeBootPromise = (async () => {
  try {
    await getTransformersModule();
    notifyBackground("wwp:aiRuntimeReady", { modelId: MODEL_ID });
    return true;
  } catch (error) {
    const message = toErrorMessage(error);
    notifyBackground("wwp:aiRuntimeBootError", { error: message });
    throw new Error(message);
  }
})();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;
  if (message.target !== "offscreen-ai") return;

  (async () => {
    try {
      if (message.type === "wwp:aiEmbeddingSmokeTest") {
        await runtimeBootPromise;
        const result = await runEmbeddingSmokeTest(message.payload && message.payload.text);
        sendResponse(result);
        return;
      }
      sendResponse({ ok: false, error: `Unknown offscreen AI message: ${message.type}` });
    } catch (error) {
      sendResponse({ ok: false, error: toErrorMessage(error) });
    }
  })();

  return true;
});

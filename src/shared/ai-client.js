(function initAiClient(global) {
  const ns = (global.WWP = global.WWP || {});

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message || "Runtime message failed"));
            return;
          }
          if (!response) {
            reject(new Error("No response from background runtime"));
            return;
          }
          if (response.ok === false) {
            reject(new Error(response.error || "AI runtime request failed"));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  ns.aiClient = {
    async runEmbeddingSmokeTest(text) {
      const payload = {
        text: String(text || "")
      };
      return sendMessage({
        type: "wwp:aiEmbeddingSmokeTest",
        payload
      });
    }
  };
})(globalThis);

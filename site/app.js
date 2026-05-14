const copyButtons = Array.from(document.querySelectorAll("[data-copy]"));
const statusNode = document.getElementById("clipboard-status");

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      console.warn("Clipboard API unavailable, falling back to manual copy.", error);
    }
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";
  document.body.appendChild(helper);
  helper.select();
  const didCopy = document.execCommand("copy");
  document.body.removeChild(helper);

  if (!didCopy) {
    throw new Error("Fallback copy failed");
  }
}

function setButtonState(button, copied) {
  const label = button.querySelector(".button-copy-text");

  if (!label) {
    return;
  }

  const defaultText = button.dataset.copyText || label.textContent;
  const copiedText = button.dataset.copiedText || "Copied";

  label.textContent = copied ? copiedText : defaultText;
}

copyButtons.forEach((button) => {
  button.addEventListener("click", async (event) => {
    const copyValue = button.dataset.copy;
    const href = button.getAttribute("href");

    if (!copyValue) {
      return;
    }

    if (href && href.startsWith("#")) {
      event.preventDefault();
    }

    if (href && href.startsWith("#")) {
      const target = document.querySelector(href);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    try {
      await copyText(copyValue);
      setButtonState(button, true);

      if (statusNode) {
        statusNode.textContent = `${button.dataset.copiedText || "Copied"}. Paste it into your terminal.`;
      }

      window.setTimeout(() => {
        setButtonState(button, false);
      }, 2000);
    } catch (error) {
      if (statusNode) {
        statusNode.textContent = "Could not copy automatically. Select the install command in the panel below.";
      }
      console.error("Copy failed", error);
    }
  });
});

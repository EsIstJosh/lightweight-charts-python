import { glob } from "fs";
import { Handler } from "../general";
import { ContextMenu} from "./context-menu";
import { GlobalParams } from "../general";
declare const window: GlobalParams;

/**
 * Interface for objects that can be serialized to and from JSON.
 */
export interface IJsonSerializable {
  toJSON(): any;
  fromJSON(json: any): void;
  title: string;
  _type: string;
  updateView?(): void;
  // Optionally, these properties may exist for options extraction:
  options?: (() => any) | any;
  _options?: any;
}

export interface DataMenuOptions {
  contextMenu: ContextMenu; // Your existing ContextMenu instance.
  handler: Handler;         // Replace with your actual Handler type.
}

export class DataMenu {
  private contextMenu: ContextMenu;
  private handler: Handler;
  private container: HTMLElement;
  // Set the default active tab to "options" (primary).
  private currentTab: "full" | "options" = "options";

  constructor(options: DataMenuOptions) {
    this.contextMenu = options.contextMenu;
    this.handler = options.handler;
    // Use the context menu's container as the modal container.
    this.container = this.contextMenu.div;
  }

  /**
   * Opens the export/import dialog modal.
   * The modal has two tabs: one for full serialization and one for options.
   * Each tab has its own set of export/import buttons.
   * A common Save button is provided.
   *
   * @param target - The object to export/import (must implement IJsonSerializable).
   * @param event - An optional MouseEvent used for positioning.
   */
  public openMenu(target: IJsonSerializable, event?: MouseEvent, overrideType?: string): void {
    // Determine the type to export using the override if provided.
    const typeStr = overrideType || (target as any)._type || target.constructor.name;
  

    // Compute JSON strings for full serialization.
    const fullData = {
      type: typeStr,
      object: target.toJSON(), // Using "object" instead of "data"
      title: target.title,
    };
    const fullJson = JSON.stringify(fullData, null, 2);
    
    // Retrieve options. If the target is a Handler, use target.chart.options().
    let opts: any = {};
    if (target instanceof Handler) {
      opts = (target as Handler).chart.options();
    } else if (target.options !== undefined) {
      opts = typeof target.options === "function" ? target.options() : target.options;
    } else if ((target as any)._options !== undefined) {
      opts = (target as any)._options;
    }
    
    // Use the key 'options' for the options export.
    const optionsData = {
...opts
    };
    const optionsJson = JSON.stringify(optionsData, null, 2);
    
  
    const modalOverlay = document.createElement("div");
    modalOverlay.style.position = "fixed";
    modalOverlay.style.top = "0";
    modalOverlay.style.left = "0";
    modalOverlay.style.width = "100%";
    modalOverlay.style.height = "100%";
    modalOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    modalOverlay.style.display = "flex";
    modalOverlay.style.justifyContent = "center";
    modalOverlay.style.alignItems = "center";
    modalOverlay.style.zIndex = "1000";

    // Close the modal when the Esc key is pressed.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.close(modalOverlay, handleKeyDown);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    // Create the modal content container.
    const modalContent = document.createElement("div");
    // Set dark mode for both tabs.
    modalContent.style.backgroundColor = "#333";
    modalContent.style.color = "#fff";
    modalContent.style.padding = "20px";
    modalContent.style.borderRadius = "8px";
    modalContent.style.width = "80%";
    modalContent.style.maxWidth = "800px";
    modalContent.style.maxHeight = "90%";
    modalContent.style.overflowY = "auto";
    modalContent.style.boxShadow = "0 2px 10px rgba(0,0,0,0.5)";
    modalContent.setAttribute("tabindex", "-1");
    modalContent.focus();

    // Create tab headers. Options tab will be on the left.
    const tabsContainer = document.createElement("div");
    tabsContainer.style.display = "flex";
    tabsContainer.style.borderBottom = "1px solid #555";
    tabsContainer.style.marginBottom = "10px";

    const optionsTab = document.createElement("button");
    optionsTab.textContent = "Options";
    optionsTab.style.flex = "1";
    optionsTab.style.padding = "10px";
    optionsTab.style.cursor = "pointer";
    optionsTab.style.border = "none";
    // Active tab background.
    optionsTab.style.backgroundColor = this.currentTab === "options" ? "#555" : "#333";
    optionsTab.onclick = () => {
      this.currentTab = "options";
      optionsTab.style.backgroundColor = "#555";
      fullTab.style.backgroundColor = "#333";
      textarea.value = optionsJson;
      optionsButtonsContainer.style.display = "flex";
      fullButtonsContainer.style.display = "none";
    };

    const fullTab = document.createElement("button");
    fullTab.textContent = "Full";
    fullTab.style.flex = "1";
    fullTab.style.padding = "10px";
    fullTab.style.cursor = "pointer";
    fullTab.style.border = "none";
    fullTab.style.backgroundColor = this.currentTab === "full" ? "#555" : "#333";
    fullTab.onclick = () => {
      this.currentTab = "full";
      fullTab.style.backgroundColor = "#555";
      optionsTab.style.backgroundColor = "#333";
      textarea.value = fullJson;
      fullButtonsContainer.style.display = "flex";
      optionsButtonsContainer.style.display = "none";
    };

    // Append tabs in the order: Options (left), then Full (right).
    tabsContainer.appendChild(optionsTab);
    tabsContainer.appendChild(fullTab);
    modalContent.appendChild(tabsContainer);

    // Title element.
    const titleElem = document.createElement("h2");
    titleElem.textContent = `Export/Import ${target.title} Data`;
    modalContent.appendChild(titleElem);

    // Create the textarea for JSON editing.
    const textarea = document.createElement("textarea");
    // Since currentTab defaults to "options", display options JSON.
    textarea.value = this.currentTab === "full" ? fullJson : optionsJson;
    textarea.style.width = "100%";
    textarea.style.height = "400px";
    textarea.style.marginTop = "10px";
    textarea.style.marginBottom = "10px";
    textarea.style.resize = "vertical";
    // Dark mode styling.
    textarea.style.backgroundColor = "#444";
    textarea.style.color = "#fff";
    textarea.setAttribute("aria-label", "JSON Data Editor");
    modalContent.appendChild(textarea);

    // Create two separate button containers for each tab.
    const fullButtonsContainer = document.createElement("div");
    fullButtonsContainer.style.display = this.currentTab === "full" ? "flex" : "none";
    fullButtonsContainer.style.flexWrap = "wrap";
    fullButtonsContainer.style.justifyContent = "flex-end";
    fullButtonsContainer.style.gap = "10px";

  const exportFullButton = document.createElement("button");
  exportFullButton.textContent = "Export";
  exportFullButton.style.padding = "8px 12px";
  exportFullButton.style.cursor = "pointer";
  exportFullButton.style.backgroundColor = "#f44336";
  exportFullButton.style.color = "#fff";
  exportFullButton.style.border = "none";
  exportFullButton.style.borderRadius = "4px";
  exportFullButton.onclick = () => {
    this.downloadJson(fullJson, `${target.title}_full.json`);
  };
  fullButtonsContainer.appendChild(exportFullButton);

  const importFullButton = document.createElement("button");
  importFullButton.textContent = "Import";
  importFullButton.style.padding = "8px 12px";
  importFullButton.style.cursor = "pointer";
  importFullButton.style.backgroundColor = "#4CAF50";
  importFullButton.style.color = "#fff";
  importFullButton.style.border = "none";
  importFullButton.style.borderRadius = "4px";
  importFullButton.onclick = () => {
    try {
      const modifiedData = JSON.parse(textarea.value);
      if (typeof modifiedData !== "object" || !modifiedData.object) {
        throw new Error("Invalid structure: missing 'object'.");
      }
      target.fromJSON(modifiedData.object);
      if (typeof target.updateView === "function") {
        target.updateView();
      }
      this.showNotification("Whole data imported successfully.", "success");
    } catch (error: any) {
      this.showNotification("Failed to import whole data: " + error.message, "error");
    }
  };
  fullButtonsContainer.appendChild(importFullButton);

  const optionsButtonsContainer = document.createElement("div");
  optionsButtonsContainer.style.display = this.currentTab === "options" ? "flex" : "none";
  optionsButtonsContainer.style.flexWrap = "wrap";
  optionsButtonsContainer.style.justifyContent = "flex-end";
  optionsButtonsContainer.style.gap = "10px";

  const exportOptionsButton = document.createElement("button");
  exportOptionsButton.textContent = "Export Options";
  exportOptionsButton.style.padding = "8px 12px";
  exportOptionsButton.style.cursor = "pointer";
  exportOptionsButton.style.backgroundColor = "#f44336";
  exportOptionsButton.style.color = "#fff";
  exportOptionsButton.style.border = "none";
  exportOptionsButton.style.borderRadius = "4px";
  exportOptionsButton.onclick = () => {
    this.downloadJson(optionsJson, `${target.title}_options.json`);
  };
  optionsButtonsContainer.appendChild(exportOptionsButton);
  const importOptionsButton = document.createElement("button");
  importOptionsButton.textContent = "Import Options";
  importOptionsButton.style.padding = "8px 12px";
  importOptionsButton.style.cursor = "pointer";
  importOptionsButton.style.backgroundColor = "#4CAF50";
  importOptionsButton.style.color = "#fff";
  importOptionsButton.style.border = "none";
  importOptionsButton.style.borderRadius = "4px";
  importOptionsButton.onclick = () => {
    // Create a hidden file input element and trigger its click.
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = () => {
          try {
            // Get the file contents (as text)
            const fileContents = reader.result;
            if (typeof fileContents !== "string") {
              throw new Error("File content is not a string.");
            }
            // Replace the textarea content with the imported JSON
            textarea.value = fileContents;
            // Parse the JSON content
            const modifiedData = JSON.parse(fileContents);
            // Check that the expected key exists.
            if (typeof modifiedData !== "object" || !modifiedData.options) {
              throw new Error("Invalid structure: missing 'options'.");
            }
            target.fromJSON(modifiedData.options);
            if (typeof target.updateView === "function") {
              target.updateView();
            }
            this.showNotification("Options imported successfully.", "success");
          } catch (error: any) {
            this.showNotification("Failed to import options: " + error.message, "error");
          }
        };
        reader.readAsText(file);
      }
    });
    fileInput.click();
  };
  optionsButtonsContainer.appendChild(importOptionsButton);
  const saveButton = document.createElement("button");
  saveButton.textContent = "Save";
  saveButton.style.padding = "8px 12px";
  saveButton.style.cursor = "pointer";
  saveButton.style.backgroundColor = "#008CBA";
  saveButton.style.color = "#fff";
  saveButton.style.border = "none";
  saveButton.style.borderRadius = "4px";
  saveButton.onclick = () => {
    try {
      const modifiedData = JSON.parse(textarea.value);
      if (typeof modifiedData !== "object" || !modifiedData.options) {
        throw new Error("Invalid structure: missing 'options'.");
      }
      target.fromJSON(modifiedData);
      if (typeof target.updateView === "function") {
        target.updateView();
      }
      this.showNotification("Options saved successfully.", "success");
    } catch (error: any) {
      this.showNotification("Failed to save options: " + error.message, "error");
    }
  };


// In your DataMenu's openMenu method (or where you add the Save as Default button)
const saveDefaultButton = document.createElement("button");
saveDefaultButton.textContent = "Save as Default";
saveDefaultButton.style.padding = "8px 12px";
saveDefaultButton.style.cursor = "pointer";
saveDefaultButton.style.backgroundColor = "#008CBA";
saveDefaultButton.style.color = "#fff";
saveDefaultButton.style.border = "none";
saveDefaultButton.style.borderRadius = "4px";
saveDefaultButton.onclick = () => {
  let opts: any = {};
  // Extract options from the target.
  if (target instanceof Handler) {
    opts = target.chart.options();
  } else if (typeof target.options === "function") {
    opts = target.options();
  } else if (target.options !== undefined) {
    opts = target.options;
  } else if ((target as any)._options !== undefined) {
    opts = (target as any)._options;
  }
  // Build a JSON string strictly containing the options.
  const optionsJson = JSON.stringify(opts, null, 2);
  
  // Determine the key:
  // If target._type is "custom/Custom" (case-insensitive), then prompt the user.
  // Otherwise, use target._type converted to lowercase. If _type is undefined, fallback to target.title.
  let key: string;
  if (target._type && target._type.toLowerCase() === "custom/custom") {
    key = prompt("Enter save key (e.g., area, line, candlestick):", target.title.toLowerCase()) || "";
    if (!key) return; // abort if no key is provided.
  } else {
    key = target._type ? target._type.toLowerCase() : target.title.toLowerCase();
  }
  
  // Build the callback message using a fixed prefix "save_defaults" and the key and options JSON separated by ";;;"
  const message = `save_defaults_~_${key};;;${optionsJson}`;
  window.callbackFunction(message);
};

this.container.appendChild(saveDefaultButton);
  // Create a container for the bottom buttons that holds both sets.
  const bottomButtonsContainer = document.createElement("div");
  bottomButtonsContainer.style.display = "flex";
  bottomButtonsContainer.style.flexDirection = "column";
  bottomButtonsContainer.style.gap = "10px";
  bottomButtonsContainer.appendChild(fullButtonsContainer);
  bottomButtonsContainer.appendChild(optionsButtonsContainer);
  bottomButtonsContainer.appendChild(saveButton);
  bottomButtonsContainer.appendChild(saveDefaultButton);

  modalContent.appendChild(bottomButtonsContainer);
  modalOverlay.appendChild(modalContent);
  this.container.appendChild(modalOverlay);

  if (event) {
    // Custom positioning logic can be added here.
  }
}

private downloadJson(jsonData: string, filename: string): void {
  try {
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    this.showNotification("Failed to download data: " + error, "error");
  }
}
public addSaveDefaultButton(target: IJsonSerializable): void {
  const saveDefaultButton = document.createElement("button");
  saveDefaultButton.textContent = "Save as Default";
  saveDefaultButton.style.padding = "8px 12px";
  saveDefaultButton.style.cursor = "pointer";
  saveDefaultButton.style.backgroundColor = "#008CBA";
  saveDefaultButton.style.color = "#fff";
  saveDefaultButton.style.border = "none";
  saveDefaultButton.style.borderRadius = "4px";

  saveDefaultButton.onclick = () => {
    let opts: any = {};
    // Extract options from the target.
    if (target instanceof Handler) {
      // For a Handler, use its chart options.
      opts = target.chart.options();
    } else if (typeof target.options === "function") {
      opts = target.options();
    } else if (target.options !== undefined) {
      opts = target.options;
    } else if ((target as any)._options !== undefined) {
      opts = (target as any)._options;
    }
    // Build a JSON string strictly containing the options.
    const optionsJson = JSON.stringify(opts, null, 2);
    // Use the target's title (lowercase) as the key.
    // Prompt the user for the key, defaulting to target.title.toLowerCase().
    const key = prompt("Enter save key (area, line, trend-trace, candlestick etc):", target.title.toLowerCase());
    if (!key) {
      // User cancelled or provided an empty key; abort saving.
      return;
    }
    
    // Build the callback message.
    const message = `save_defaults_${key}_~_${optionsJson}`;
    // Call the global callback function.
    window.callbackFunction(message);
    };

      this.container.appendChild(saveDefaultButton);
    }

private close(overlay: HTMLElement, keyDownHandler: (e: KeyboardEvent) => void): void {
  if (overlay.parentElement) {
    overlay.parentElement.removeChild(overlay);
  }
  document.removeEventListener("keydown", keyDownHandler);
}

private showNotification(message: string, type: "success" | "error"): void {
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.bottom = "20px";
  notification.style.right = "20px";
  notification.style.padding = "10px 20px";
  notification.style.borderRadius = "4px";
  notification.style.color = "#fff";
  notification.style.backgroundColor = type === "success" ? "#4CAF50" : "#f44336";
  notification.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  notification.style.zIndex = "1001";
  notification.style.opacity = "0";
  notification.style.transition = "opacity 0.5s ease-in-out";
  this.container.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = "1";
  }, 100);

  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      if (notification.parentElement) {
        notification.parentElement.removeChild(notification);
      }
    }, 500);
  }, 3000);
}}
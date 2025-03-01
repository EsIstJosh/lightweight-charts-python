
/**
 * A simple DefaultOptionsManager to store default options in memory.
 *
 * This class provides a single method, `set`, to update the default options for a given key.
 * The scripts are stored in an in-memory Map.
 *
 * Usage:
 *   const manager = new DefaultOptionsManager();
 *   manager.set("area", { title: "Area", lineColor: "#021698", topColor: "rgba(9,32,210,0.4)", bottomColor: "rgba(0,0,0,0.5)" });
 *   const areaDefaults = manager.get("area");
 */
export class PineScriptManager {
    // In-memory storage for default options.
    public scripts: Map<string, any>;
    constructor() {
      this.scripts = new Map<string, any>();
      }
    
  /**
     * Sets the default options for the given key.
     * If the provided data is a JSON string, it will be parsed into an object.
     *
     * @param key - A string identifying the default options (e.g., "area", "line").
     * @param data - The default options to store, either as an object or a JSON string.
     */
  public set(key: string, data: any): void {
    let parsedData: any;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (error) {
        console.error(`Error parsing JSON string for key "${key}":`, error);
        // Optionally, you can throw an error here or fallback to the raw string.
        parsedData = data; // fallback: store the string if parsing fails.
      }
    } else {
      parsedData = data;
    }
    this.scripts.set(key, parsedData);
    console.log(`Default options for key "${key}" set successfully.`);
    console.log(parsedData)
  }

  public get(key: string): any | null {
    if (this.scripts.has(key)) {
      return this.scripts.get(key);
    } else {
      return null;
    }
  }

    /**
     * Returns all stored scripts.
     *
     * @returns A Map containing all default options.
     */
    public getAll(): Map<string, any> {
      return this.scripts;
    }



     
  /**
   * Retrieves the most recent script that was added.
   * Since Map preserves insertion order, this returns the last inserted value.
   *
   * @returns The most recent script object, or null if none exist.
   */
  public getLast(): any | null {
    if (this.scripts.size === 0) {
      return null;
    }
    // Convert the values to an array and return the last element.
    const allScripts = Array.from(this.scripts.values());
    return allScripts[allScripts.length - 1];
  }
}
  
  
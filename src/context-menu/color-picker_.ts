import { getAlphaFromColor } from "../helpers/colors";
import { GlobalParams } from "../general";
declare const window: GlobalParams;
export class ColorPicker {

       
    private container: HTMLDivElement;
    private _opacitySlider!: HTMLInputElement;
    private _opacity_label!: HTMLDivElement;
    private exitButton!: HTMLDivElement;
    public color: string = "#ff0000";
    private rgba: number[]; // [R, G, B, A]
    private opacity: number;
    private applySelection: (color: string) => void;
    private customColors?: string[];
  
    constructor(
        initialValue: string,
        applySelection: (color: string) => void,
        customColors?: string[] | null,
      ) {
    this.applySelection = applySelection;
    this.rgba = ColorPicker.extractRGBA(initialValue);
    this.opacity = this.rgba[3];
    this.container = document.createElement("div");
    this.container.classList.add("color-picker");
    this.container.style.display = "flex";
    this.container.style.flexDirection = "column";
    this.container.style.width = "300px";
    this.container.style.height = "350px";
    this.container.style.position = "relative"; // Ensure proper positioning for the exit button.

    // Build UI elements
    const colorGrid = this.createColorGrid();
    const opacityUI = this.createOpacityUI();
    this.exitButton = this.createExitButton(); // Create the exit button.
    this.customColors = customColors??undefined;

    // Append elements to the container
    this.container.appendChild(colorGrid);
    this.container.appendChild(this.createSeparator());
    if (this.customColors && this.customColors.length !== 0){
    this.createCustomColorSection()
    }
    this.container.appendChild(this.createSeparator());
    this.container.appendChild(opacityUI);
    this.container.appendChild(this.exitButton); // Append the exit button last
}


    private createCustomColorSection(): HTMLDivElement | null {
        // Only build the custom colors section if a custom colors list is provided.
        if (!this.customColors || this.customColors.length === 0) {
          return null;
        }
        
        const customContainer = document.createElement("div");
        customContainer.style.display = "flex";
        customContainer.style.flexDirection = "column";
        customContainer.style.alignItems = "center";
        customContainer.style.margin = "8px 0";
      
        const title = document.createElement("div");
        title.innerText = "Custom Colors";
        title.style.fontSize = "12px";
        title.style.color = "white";
        customContainer.appendChild(title);
      
        // Create a container row for custom color swatches.
        const swatchContainer = document.createElement("div");
        swatchContainer.style.display = "flex";
        swatchContainer.style.flexWrap = "wrap";
        swatchContainer.style.justifyContent = "center";
        swatchContainer.style.gap = "5px";
      
        // Function to create a swatch element.
        const createSwatch = (color: string): HTMLDivElement => {
          const swatch = document.createElement("div");
          swatch.style.width = "20px";
          swatch.style.height = "20px";
          swatch.style.borderRadius = "4px";
          swatch.style.cursor = "pointer";
          swatch.style.border = "1px solid #999";
          swatch.style.backgroundColor = color;
          swatch.title = color;
          // When clicked, update the target color using this custom color.
          swatch.addEventListener("click", () => {
            this.updateTargetColor();
          });
          return swatch;
        };
      
        // Append existing custom color swatches.
        this.customColors.forEach((color) => {
          swatchContainer.appendChild(createSwatch(color));
        });
      
        // Create an additional swatch for adding a new custom color.
        const addSwatch = document.createElement("div");
        addSwatch.style.width = "20px";
        addSwatch.style.height = "20px";
        addSwatch.style.borderRadius = "4px";
        addSwatch.style.cursor = "pointer";
        addSwatch.style.border = "1px solid #999";
        addSwatch.style.backgroundColor = "rgba(0,0,0,0)"; // Transparent background
        addSwatch.style.display = "flex";
        addSwatch.style.justifyContent = "center";
        addSwatch.style.alignItems = "center";
        addSwatch.style.color = "#999";
        addSwatch.style.fontSize = "16px";
        addSwatch.innerText = "+";
        addSwatch.title = "Add custom color";
      
        addSwatch.addEventListener("click", (evt: MouseEvent) => {
          // Create a hidden input of type color (native color picker, often displayed as a gradient wheel)
          const colorInput = document.createElement("input");
          colorInput.type = "color";
          // Optionally, set a default value (using current color)
          colorInput.value = this.color;
          // Hide the input element.
          colorInput.style.position = "absolute";
          colorInput.style.left = "-9999px";
          document.body.appendChild(colorInput);
          
          // When a color is picked:
          colorInput.addEventListener("input", () => {
            this.color = colorInput.value;
            this.updateTargetColor();
            if (!this.customColors!.includes(this.color)) {
              this.customColors!.push(this.color);
              swatchContainer.appendChild(createSwatch(this.color));
              this.saveColors()
            }
            document.body.removeChild(colorInput);
          }, { once: true });
          
          // Programmatically open the native color picker.
          colorInput.click();
        });
        
        swatchContainer.appendChild(addSwatch);
        customContainer.appendChild(swatchContainer);
        return customContainer;
      }
      
    private saveColors(): void {
        // Ensure customColors exists.
        
        // Convert the updated customColors array to a pretty-printed JSON string.
        const dataString = JSON.stringify(this.customColors, null, 2);
        
        // Define the key for the saved defaults. You can use a default key such as "customColors".
        const key = "colors";
        
        // Build the message using your standard format.
        const message = `save_defaults_${key}_~_${dataString}`;
        
        // Call the global callback function to save the defaults.
        window.callbackFunction(message);
    }
      
    
    private createExitButton(): HTMLDivElement {
        const button = document.createElement('div');
        button.innerText = '✕'; // Close icon
        button.title = 'Close';
        button.style.position = 'absolute';
        button.style.bottom = '5px'; // Move to the bottom
        button.style.right = '5px'; // Default bottom-right corner
        button.style.width = '20px';
        button.style.height = '20px';
        button.style.cursor = 'pointer';
        button.style.display = 'flex';
        button.style.justifyContent = 'center';
        button.style.alignItems = 'center';
        button.style.fontSize = '16px';
        button.style.backgroundColor = '#ccc';
        button.style.borderRadius = '50%';
        button.style.color = '#000';
        button.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
    
        // Add hover effect
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#e74c3c'; // Red hover color
            button.style.color = '#fff'; // White text on hover
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#ccc';
            button.style.color = '#000';
        });
    
        // Close the menu when clicked
        button.addEventListener('click', () => {
            this.closeMenu();
        });
    
        return button;
    }
    private createColorGrid(): HTMLDivElement {
        const colorGrid = document.createElement('div');
        colorGrid.style.display = 'grid';
        colorGrid.style.gridTemplateColumns = 'repeat(7, 1fr)'; // 5 columns
        colorGrid.style.gap = '5px';
        colorGrid.style.overflowY = 'auto';
        colorGrid.style.flex = '1';
    
        const colors = ColorPicker.generateFullSpectrumColors(9); // Generate vibrant colors
        colors.forEach((color) => {
            const box = this.createColorBox(color);
            colorGrid.appendChild(box);
        });
    
        return colorGrid;
    }
    
    private createColorBox(color: string): HTMLDivElement {
        const box = document.createElement("div");
        box.style.aspectRatio = ".8"; // Maintain square shape
        box.style.borderRadius = "6px";
        box.style.backgroundColor = color;
        box.style.cursor = "pointer";
    
        box.addEventListener("click", () => {
            this.rgba = ColorPicker.extractRGBA(color);
            this.updateTargetColor();
        });
        
        return box;
    }
    

    private static generateFullSpectrumColors(stepsPerTransition: number): string[] {
        const colors: string[] = [];
    
        // Red to Green (255, 0, 0 → 255, 255, 0)
        for (let g = 0; g <= 255; g += Math.floor(255 / stepsPerTransition)) {
            colors.push(`rgba(255, ${g}, 0, 1)`);
        }
    
        // Green to Yellow-Green to Green-Blue (255, 255, 0 → 0, 255, 0)
        for (let r = 255; r >= 0; r -= Math.floor(255 / stepsPerTransition)) {
            colors.push(`rgba(${r}, 255, 0, 1)`);
        }
    
        // Green to Cyan (0, 255, 0 → 0, 255, 255)
        for (let b = 0; b <= 255; b += Math.floor(255 / stepsPerTransition)) {
            colors.push(`rgba(0, 255, ${b}, 1)`);
        }
    
        // Cyan to Blue (0, 255, 255 → 0, 0, 255)
        for (let g = 255; g >= 0; g -= Math.floor(255 / stepsPerTransition)) {
            colors.push(`rgba(0, ${g}, 255, 1)`);
        }
    
        // Blue to Magenta (0, 0, 255 → 255, 0, 255)
        for (let r = 0; r <= 255; r += Math.floor(255 / stepsPerTransition)) {
            colors.push(`rgba(${r}, 0, 255, 1)`);
        }
    
        // Magenta to Red (255, 0, 255 → 255, 0, 0)
        for (let b = 255; b >= 0; b -= Math.floor(255 / stepsPerTransition)) {
            colors.push(`rgba(255, 0, ${b}, 1)`);
        }
    
        // White to Black (255, 255, 255 → 0, 0, 0)
        for (let i = 255; i >= 0; i -= Math.floor(255 / stepsPerTransition)) {
            colors.push(`rgba(${i}, ${i}, ${i}, 1)`);
        }
    
        return colors;
    }
    private createOpacityUI(): HTMLDivElement {
        const opacityContainer = document.createElement("div");
        opacityContainer.style.margin = "10px";
        opacityContainer.style.display = "flex";
        opacityContainer.style.flexDirection = "column";
        opacityContainer.style.alignItems = "center";

        const opacityText = document.createElement("div");
        opacityText.style.color = "lightgray";
        opacityText.style.fontSize = "12px";
        opacityText.innerText = "Opacity";

        this._opacitySlider = document.createElement("input");
        this._opacitySlider.type = "range";
        this._opacitySlider.min = "0";
        this._opacitySlider.max = "100";
        this._opacitySlider.value = (this.opacity * 100).toString();
        this._opacitySlider.style.width = "80%";

        this._opacity_label = document.createElement("div");
        this._opacity_label.style.color = "lightgray";
        this._opacity_label.style.fontSize = "12px";
        this._opacity_label.innerText = `${this._opacitySlider.value}%`;

        this._opacitySlider.oninput = () => {
            this._opacity_label.innerText = `${this._opacitySlider.value}%`;
            this.opacity = parseInt(this._opacitySlider.value) / 100;
            this.updateTargetColor();
        };

        opacityContainer.appendChild(opacityText);
        opacityContainer.appendChild(this._opacitySlider);
        opacityContainer.appendChild(this._opacity_label);

        return opacityContainer;
    }


  
    private createSeparator(): HTMLDivElement {
        const separator = document.createElement("div");
        separator.style.height = "1px";
        separator.style.width = "100%";
        separator.style.backgroundColor = "#ccc";
        separator.style.margin = "5px 0";
        return separator;
    }
    public openMenu(
        event: MouseEvent,
        parentMenuWidth: number, // Width of the parent menu
        applySelection: (color: string) => void,
      ): void {
        this.applySelection = applySelection;
        
        // Attach menu to DOM temporarily to calculate dimensions.
        this.container.style.display = 'block';
        document.body.appendChild(this.container);
        
        // Calculate submenu dimensions.
        const submenuWidth = this.container.offsetWidth || 150;
        const submenuHeight = this.container.offsetHeight || 250;
        
        // Get mouse position.
        const cursorX = event.clientX;
        const cursorY = event.clientY;
        
        // Get viewport dimensions.
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Calculate position relative to the parent menu.
        let left = cursorX + parentMenuWidth;
        let top = cursorY;
        
        // Adjust position to avoid overflowing viewport.
        const adjustedLeft = left + submenuWidth > viewportWidth ? cursorX - submenuWidth : left;
        const adjustedTop = top + submenuHeight > viewportHeight ? viewportHeight - submenuHeight - 10 : top;
        
        this.container.style.left = `${adjustedLeft}px`;
        this.container.style.top = `${adjustedTop}px`;
        this.container.style.display = 'flex';
        this.container.style.position = 'absolute';
        
        // Ensure the exit button stays within bounds.
        this.exitButton.style.bottom = '5px';
        this.exitButton.style.right = '5px';
        
        // Define the auto-close handler.
        const onMouseMove = (e: MouseEvent) => {
          const rect = this.container.getBoundingClientRect();
          // Extend the container bounds.
          const extendedRect = {
            left: rect.left - submenuWidth,
            right: rect.right + submenuWidth,
            top: rect.top - submenuHeight,
            bottom: rect.bottom + submenuHeight,
          };
          if (
            e.clientX < extendedRect.left ||
            e.clientX > extendedRect.right ||
            e.clientY < extendedRect.top ||
            e.clientY > extendedRect.bottom
          ) {
            this.closeMenu();
            document.removeEventListener('mousemove', onMouseMove);
          }
        };
      
        // Only start auto-close tracking when the mouse is over the container.
        this.container.addEventListener('mouseenter', () => {
          document.addEventListener('mousemove', onMouseMove);
        });
        this.container.addEventListener('mouseleave', () => {
          document.removeEventListener('mousemove', onMouseMove);
          this.closeMenu();
        });
        
        // Also close the menu when clicking outside.
        document.addEventListener('mousedown', this._handleOutsideClick.bind(this), { once: true });
      }
    
    public closeMenu(): void {
        this.container.style.display = 'none';
        document.removeEventListener('mousedown', this._handleOutsideClick);
    }
    private _handleOutsideClick(event: MouseEvent): void {
        if (!this.container.contains(event.target as Node)) {
            this.closeMenu();
        }
    }


    private static extractRGBA(color: string): number[] {
        const dummyElem = document.createElement('div');
        dummyElem.style.color = color;
        document.body.appendChild(dummyElem);
        const computedColor = getComputedStyle(dummyElem).color;
        document.body.removeChild(dummyElem);

        const rgb = computedColor.match(/\d+/g)?.map(Number) || [0, 0, 0];
        const opacity = computedColor.includes("rgba")
            ? parseFloat(computedColor.split(",")[3])
            : 1;
        return [rgb[0], rgb[1], rgb[2], opacity];
    }
    public getElement(): HTMLDivElement {
        return this.container;
    }
    // Dynamically updates the label and selection function
    public update( initialValue: string, applySelection: (color: string) => void): void {
        this.rgba = ColorPicker.extractRGBA(initialValue);
        this.opacity = this.rgba[3];
        this.applySelection = applySelection;
        this.updateTargetColor();
    }

    private updateTargetColor(): void {
        this.color = `rgba(${this.rgba[0]}, ${this.rgba[1]}, ${this.rgba[2]}, ${this.opacity})`;
        this.applySelection(this.color); // Apply color selection immediately
            }
        }
    

import { GlobalParams } from "./global-params";

declare const window: GlobalParams

export class Menu {
    private div: HTMLDivElement;
    private isOpen: boolean = false;
    private widget: any;

    constructor(
        private makeButton: Function,
        items: string[],
        activeItem: string,
        separator: boolean,
        align: 'right'|'left',
        private callbackName?: string|null,

    ) {

        this.div = document.createElement('div')
        this.div.classList.add('topbar-menu');

        this.widget = this.makeButton(activeItem+' ↓', null, separator, true, align)

        this.updateMenuItems(items)

        this.widget.elem.addEventListener('click', () => {
            this.isOpen = !this.isOpen;
            if (!this.isOpen) {
                this.div.style.display = 'none';
                return;
            }
            let rect = this.widget.elem.getBoundingClientRect()
            this.div.style.display = 'flex'
            this.div.style.flexDirection = 'column'

            let center = rect.x+(rect.width/2)
            this.div.style.left = center-(this.div.clientWidth/2)+'px'
            this.div.style.top = rect.y+rect.height+'px'
        })
        document.body.appendChild(this.div)
    }

    updateMenuItems(items: string[]) {
        this.div.innerHTML = '';

        items.forEach(text => {
            let button = this.makeButton(text, null, false, false)
            button.elem.addEventListener('click', () => {
                this._clickHandler(button.elem.innerText);
            });
            button.elem.style.margin = '4px 4px'
            button.elem.style.padding = '2px 2px'
            this.div.appendChild(button.elem)
        })
        this.widget.elem.innerText = items[0]+' ↓';
    }
    
    private _clickHandler(name: string) {
        this.widget.elem.innerText = name+' ↓'
        window.callbackFunction(`${this.callbackName??'undefined'}_~_${name}`)
        this.div.style.display = 'none'
        this.isOpen = false
    }


}

// Define a type for menu items.
export type MenuItem = {
    label: string;
    callback?: () => void;
  };
  
  export class  ChartMenu{
    private div: HTMLDivElement;
    private isOpen: boolean = false;
    private widget: any;
    private globalCallback?: (selected: string) => void;
  
    constructor(
      private makeButton: Function,
      items: MenuItem[],
      activeItem: string,
      separator: boolean,
      align: 'right' | 'left',
      callbackName?: string | null,
      globalCallback?: (selected: string) => void
    ) {
      this.globalCallback = globalCallback;
      this.div = document.createElement("div");
      this.div.classList.add("topbar-menu");
  
      // Create the main widget button with the active item.
      this.widget = this.makeButton(activeItem + " ↓", null, separator, true, align);
  
      // Initialize the menu items.
      this.updateMenuItems(items);
  
      // Toggle the dropdown on widget click.
      this.widget.elem.addEventListener("click", () => {
        this.isOpen = !this.isOpen;
        if (!this.isOpen) {
          this.div.style.display = "none";
          return;
        }
        const rect = this.widget.elem.getBoundingClientRect();
        this.div.style.display = "flex";
        this.div.style.flexDirection = "column";
        const center = rect.x + rect.width / 2;
        this.div.style.left = center - this.div.clientWidth / 2 + "px";
        this.div.style.top = rect.y + rect.height + "px";
      });
      document.body.appendChild(this.div);
    }
  
    updateMenuItems(items: MenuItem[]): void {
      this.div.innerHTML = "";
      items.forEach(item => {
        const button = this.makeButton(item.label, null, false, false);
        button.elem.addEventListener("click", () => {
          this._clickHandler(item);
        });
        button.elem.style.margin = "4px 4px";
        button.elem.style.padding = "2px 2px";
        this.div.appendChild(button.elem);
      });
      // Update the main widget to show the first item's label.
      if (items.length > 0) {
        this.widget.elem.innerText = items[0].label + " ↓";
      }
    }
  
    private _clickHandler(item: MenuItem): void {
      // Update the widget text.
      this.widget.elem.innerText = item.label + " ↓";
      // If the item has its own callback, invoke it.
      if (item.callback) {
        item.callback();
      } else if (this.globalCallback) {
        // Otherwise, fallback to the global callback if provided.
        this.globalCallback(item.label);
      } else {
        // Alternatively, you might call a global function:
        window.callbackFunction(`${item.label}`);
      }
      // Hide the menu.
      this.div.style.display = "none";
      this.isOpen = false;
    }
  }
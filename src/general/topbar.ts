/*
 * Portions of this file are derived from [lightweight-charts-python] and are
 * licensed under the MIT License. The original copyright notice and license
 * can be found in the LICENSE file.
 *
 * Modifications by [EsIstJosh] are licensed under the GNU AGPL v3.0.
 * See <https://www.gnu.org/licenses/agpl-3.0.html> for the full license text.
 */

import { CodeEditor } from "../pineTS/code-editor";
import { GlobalParams } from "./global-params";
import { Handler } from "./handler";
import { Menu } from "./menu";

declare const window: GlobalParams

interface Widget {
    elem: HTMLDivElement;
    callbackName?: string|null;
    intervalElements?: HTMLButtonElement[];
    onItemClicked: Function;
}

export class TopBar {
    private _handler: Handler;
    public _div: HTMLDivElement;

    private left: HTMLDivElement;
    private right: HTMLDivElement;
    private codeEditor: CodeEditor;

    constructor(handler: Handler) {
        this._handler = handler;

        this._div = document.createElement('div');
        this._div.classList.add('topbar');

        const createTopBarContainer = (justification: string) => {
            const div = document.createElement('div');
            div.classList.add('topbar-container');
            div.style.justifyContent = justification;
            this._div.appendChild(div);
            return div;
        };
        this.left = createTopBarContainer('flex-start');
        this.right = createTopBarContainer('flex-end');


        this.codeEditor = new CodeEditor(this._handler); // ✅ Instantiate the Monaco Editor

        // ✅ Add a button to open the editor
        this.makeButton("()=> ƒ", true, true, "right", false,undefined,() =>
            this.codeEditor.open()
        );
    }
    makeSwitcher(items: string[], defaultItem: string, callbackName: string, align='left') {
        const switcherElement = document.createElement('div');
        switcherElement.style.margin = '4px 12px'

        let activeItemEl: HTMLButtonElement;

        const createAndReturnSwitcherButton = (itemName: string) => {
            const button = document.createElement('button');
            button.classList.add('topbar-button');
            button.classList.add('switcher-button');
            button.style.margin = '0px 2px';
            button.innerText = itemName;

            if (itemName == defaultItem) {
                activeItemEl = button;
                button.classList.add('active-switcher-button');
            }

            const buttonWidth = TopBar.getClientWidth(button)
            button.style.minWidth = buttonWidth + 1 + 'px'
            button.addEventListener('click', () => widget.onItemClicked!(button))

            switcherElement.appendChild(button);
            return button;
        }

        const widget: Widget = {
            elem: switcherElement,
            callbackName: callbackName,
            intervalElements: items.map(createAndReturnSwitcherButton),
            onItemClicked: (item: HTMLButtonElement) => {
                if (item == activeItemEl) return
                activeItemEl.classList.remove('active-switcher-button');
                item.classList.add('active-switcher-button');
                activeItemEl = item;
                window.callbackFunction(`${widget.callbackName}_~_${item.innerText}`);
            }
        }

        this.appendWidget(switcherElement, align, true)
        return widget
    }

    makeTextBoxWidget(text: string, align='left', callbackName=null) {
        if (callbackName) {
            const textBox = document.createElement('input');
            textBox.classList.add('topbar-textbox-input');
            textBox.value = text
            textBox.style.width = `${(textBox.value.length+2)}ch`
            textBox.addEventListener('focus', () => {
                window.textBoxFocused = true;
            })
            textBox.addEventListener('input', (e) => {
                e.preventDefault();
                textBox.style.width = `${(textBox.value.length+2)}ch`;
            });
            textBox.addEventListener('keydown', (e) => {
                if (e.key == 'Enter') {
                    e.preventDefault();
                    textBox.blur();
                }
            });
            textBox.addEventListener('blur', () => {
                window.callbackFunction(`${callbackName}_~_${textBox.value}`)
                window.textBoxFocused = false;
            });
            this.appendWidget(textBox, align, true)
            return textBox
        } else {
            const textBox = document.createElement('div');
            textBox.classList.add('topbar-textbox');
            textBox.innerText = text
            this.appendWidget(textBox, align, true)
            return textBox
        }
    }
    makeMenu(items: string[], activeItem: string, separator: boolean, align: 'right'|'left',callbackName?: string|null) {
        return new Menu(this.makeButton.bind(this), items, activeItem, separator, align, callbackName)
    }
    makeButton(
        defaultText: string,
        separator: boolean,
        append = true,
        align: 'left' | 'right' = 'left',
        toggle = false,
        callbackName?: string,
        callable?: (() => void) | null
    ) {
        let button = document.createElement('button');
        button.classList.add('topbar-button');
        button.innerText = defaultText;
        
        // Temporarily append to measure width
        document.body.appendChild(button);
        button.style.minWidth = `${button.clientWidth + 1}px`;
        document.body.removeChild(button);
    
        let state = false;
    
        const onItemClicked = () => {
            if (toggle) {
                state = !state;
                button.style.backgroundColor = state ? 'var(--active-bg-color)' : '';
                button.style.color = state ? 'var(--active-color)' : '';
                if (callbackName) {
                    window.callbackFunction(`${callbackName}_~_${state}`);
                }
            } else {
                if (callbackName) {
                    window.callbackFunction(`${callbackName}_~_${button.innerText}`);
                }
            }
    
            if (callable) callable();
        };
    
        button.addEventListener('click', onItemClicked);
    
        if (append) this.appendWidget(button, align, separator);
    
        return { elem: button, callbackName };
    }
        makeSliderWidget(
        min: number,
        max: number,
        step: number,
        defaultValue: number,
        callbackName: string,
        align: 'left' | 'right' = 'left'
    ) {
        // Create container for the slider
        const sliderContainer = document.createElement('div');
        sliderContainer.classList.add('topbar-slider-container');
        sliderContainer.style.display = 'flex';
        sliderContainer.style.alignItems = 'center';
        sliderContainer.style.margin = '4px 12px';
    
        // Create label for displaying the value
        const valueLabel = document.createElement('span');
        valueLabel.classList.add('topbar-slider-label');
        valueLabel.style.marginRight = '8px';
        valueLabel.innerText = defaultValue.toString();
    
        // Create the slider input
        const slider = document.createElement('input');
        slider.classList.add('topbar-slider');
        slider.type = 'range';
        slider.min = min.toString();
        slider.max = max.toString();
        slider.step = step.toString();
        slider.value = defaultValue.toString();
        slider.style.cursor = 'pointer';
    
        // Update label and trigger callback on change
        slider.addEventListener('input', () => {
            valueLabel.innerText = slider.value;
            window.callbackFunction(`${callbackName}_~_${slider.value}`);
        });
    
        // Append elements to the slider container
        sliderContainer.appendChild(valueLabel);
        sliderContainer.appendChild(slider);
    
        // Append the slider widget to the top bar
        this.appendWidget(sliderContainer, align, true);
    
        return sliderContainer;
    }
    
    makeSeparator(align='left') {
        const separator = document.createElement('div')
        separator.classList.add('topbar-seperator')
        const div = align == 'left' ? this.left : this.right
        div.appendChild(separator)
    }

    appendWidget(widget: HTMLElement, align: string, separator: boolean) {
        const div = align == 'left' ? this.left : this.right
        if (separator) {
            if (align == 'left') div.appendChild(widget)
            this.makeSeparator(align)
            if (align == 'right') div.appendChild(widget)
        } else div.appendChild(widget)
        this._handler.reSize();
    }

    private static getClientWidth(element: HTMLElement) {
        document.body.appendChild(element);
        const width = element.clientWidth;
        document.body.removeChild(element);
        return width;
    }
}



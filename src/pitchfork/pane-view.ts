import { Coordinate, Logical, } from 'lightweight-charts';
import { Point } from '../drawing/data-source';

import { ThreePointDrawingPaneView } from '../drawing/pane-view';
import { PitchFork, PitchForkOptions } from './pitchfork';
import { PitchForkPaneRenderer } from './renderer';

export interface ViewPoint {
    x: Coordinate | null;
    y: Coordinate | null;
}

export class PitchForkPaneView extends ThreePointDrawingPaneView {
    constructor(source: PitchFork) {
        super(source)
        
    }              

    renderer() {
        return new PitchForkPaneRenderer(
            this._p1,
            this._p2,
            this._p3,
            this._source._options as PitchForkOptions,
            this._source.hovered

          
        
            
        )
        
        
    }
    }
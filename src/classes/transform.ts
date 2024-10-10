/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {Coordinates} from "./coordinates.js";

export class Transform {
    public translate: Coordinates;
    public scale: Coordinates;
    constructor(scaleX: number, scaleY: number, translateX: number, translateY: number) {
        this.scale = new Coordinates(scaleX, scaleY);
        this.translate = new Coordinates(translateX, translateY);
    }

    public toStyle(offset?: Transform) {
        if (!offset) {
            offset = new Transform(0, 0, 0, 0);
        }
        return `scale(${this.scale.x + offset.scale.x},${this.scale.y + offset.scale.y}) translate(${this.translate.x + offset.translate.x}px,${this.translate.y + offset.translate.y}px)`;
    }
}

/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {path} from "d3-path";
import {Coordinates} from "./coordinates.js";
import {Dimensions} from "./dimensions.js";

export class CircularMarkerInfo {
    public image: Dimensions;
    public barEnd: number;
    public barTop: number;
    public cssClass: string;

    constructor(image: Dimensions, barEnd: number, barTop: number, cssClass: string) {
        this.image = image;
        this.barEnd = barEnd;
        this.barTop = barTop;
        this.cssClass = cssClass;
    }
}

export function addCircularMarkerGroup(container: any, info: CircularMarkerInfo, barHeight: number,
                                       backTranslation: Coordinates, fillOnly?: boolean) {
    function createPath(x: number, y: number) {
        const sizeMultiplier = 2;
        const end = x + 5 * sizeMultiplier;
        const detail = path();
        detail.moveTo(x, y);
        // all the magic numbers following are just precalculated arc points from
        // an existing bezier curve
        // bottom arc
        detail.bezierCurveTo(x + 1.4209451 * sizeMultiplier, y,
                             end, y + 0.691745,
                             end, y + 2);
        y -= barHeight - 2.6458332;
        // vertical line
        detail.lineTo(end, y - 0.4414789 * sizeMultiplier);
        // top arc
        // 4.9221477, 2.485465, 3.5070984, 1.5887336, 1.5972675, 1.5990286
        detail.bezierCurveTo(end, y - 1.7593968,
                             x + 1.9098309 * sizeMultiplier,
                             y - 2.6561282,
                             x, y - 2.6458332);
        return detail.toString();
    }

    const group = container.append("g").attr("class", `circular-marker ${info.cssClass}`);
    const basePath = createPath(info.barEnd, barHeight);
    // lower arc
    group.append("path")
        .attr("class", `circular-back-arc ${info.cssClass}`)
        .style("fill", "url(#cross-origin-region-gradient-fade)")
        .style("stroke", "none")
        .style("stroke-width", 0)  // since stroke, above, is not respected on export
        .style("transform", `scale(1, -0.66) translate(${backTranslation.x - 1}px, ${backTranslation.y - barHeight * 2}px)`)
        .attr("d", basePath + "Z");
    // upper arc
    // first the fill
    group.append("path")
        .attr("class", `circular-front-arc cluster-bar-extension ${info.cssClass}`)
        .attr("d", basePath + "Z")
        .style("stroke-width", "0")  // SVG exports won't respect the "stroke" below
        .style("stroke", "none");
    // then the lines bounding most of it
    if (!fillOnly) {
        group.append("path")
            .attr("class", `${info.cssClass} circular-border`)
            .attr("d", basePath)
            .style("stroke", "black")
            .style("fill", "none");  // explicitly covered by the paths above
    }
    return group;
}

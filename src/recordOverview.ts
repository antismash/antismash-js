/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {Path, path} from "d3-path";
import {scaleLinear as d3scaleLinear} from "d3-scale";
import {event as d3event, select as d3select} from "d3-selection";

import {addCircularMarkerGroup, CircularMarkerInfo} from "./classes/circular_marker.js";
import {Coordinates} from "./classes/coordinates.js";
import {Dimensions} from "./classes/dimensions.js";
import {IRecord, IRegion} from "./classes/pythonStructures.js";
import {Transform} from "./classes/transform.js";

const barHeight = 10;

/**
 * Creates the overview SVG for the given record, showing the locations of each region
 *
 * @param record - the index of the record
 * @param regions - the regions contained within the record
 * @param recordLength - the length of the record in nucleotides
 */
function createRecordOverview(record: number, regions: IRegion[], recordLength: number): void {
    if (regions.length === 0) {
        return;
    }
    const height = 40;
    const width = 830;

    const container = d3select(`#record-minimap-${record}`);
    container
        .attr("width", width)
        .attr("height", height);

    const linePadding = 20;
    const recordScale = d3scaleLinear()
        .domain([0, recordLength])
        .range([linePadding, width - linePadding]);

    container.append("line")
        .attr("x1", recordScale(0))
        .attr("y1", 20)
        .attr("x2", recordScale(recordLength))
        .attr("y2", 20)
        .attr("class", "centerline");

    container.append("line")
        .attr("x1", recordScale(0))
        .attr("y1", 0)
        .attr("x2", recordScale(0))
        .attr("y2", height)
        .attr("class", "minimap-record-end centerline");

    container.append("line")
        .attr("x1", recordScale(recordLength))
        .attr("y1", 0)
        .attr("x2", recordScale(recordLength))
        .attr("y2", height)
        .attr("class", "minimap-record-end centerline");

    regions.forEach((data: IRegion) => {
        // before drawing this region, if it's cross-origin, set up a couple of
        // little circularity markers
        if (data.end > recordLength) {
            const defs = container.append("defs");
            const fader = defs.append("linearGradient")
                .attr("id", "cross-origin-region-gradient-fade")
                .attr("x1", "0%")
                .attr("x2", "100%")
                .attr("y1", "0%")
                .attr("y2", "0%");
            fader.append("stop")
                .attr("offset", "0%")
                .style("stop-opacity", 0);
            fader.append("stop")
                .attr("offset", "50%")
                .style("stop-opacity", .75);
            fader.append("stop")
                .attr("offset", "100%")
                .style("stop-opacity", 1);
            const info = new CircularMarkerInfo(new Dimensions(height, width), recordScale(recordLength), 15, data.cssClass);
            // right hand side
            addCircularMarkerGroup(container, info, barHeight, new Coordinates(0, 0))
                .attr("class", "right-circular-marker")
                .style("transform", new Transform(1, 1, 0, 15).toStyle());
            // left hand side
            addCircularMarkerGroup(container, info, barHeight, new Coordinates(1, 0))
                .attr("class", "left-circular-marker")
                .style("transform", new Transform(-1, 1, -width, 15).toStyle());
        }
        const group = container.append("g");
        group.append("rect")
            .attr("class", `minimap-region ${data.cssClass}`)
            .attr("y", 15)
            .attr("x", recordScale(data.start))
            .attr("width", recordScale(Math.min(data.end, recordLength)) - recordScale(data.start))
            .attr("height", 10)
            .style("stroke", data.end > recordLength ? "none" : "black");
        // and the label for it
        const regionNumber = parseInt(data.anchor.split("c")[1], 10);
        const labelLineBottom = regionNumber % 2 === 0 ? 25 : 15;
        const labelLineTop = regionNumber % 2 === 0 ? 30 : 10;
        group.append("line")
            .attr("class", "minimap-region-label-line centerline")
            .attr("x1", recordScale((data.start + Math.min(data.end, recordLength)) / 2))
            .attr("y1", labelLineBottom)
            .attr("x2", recordScale((data.start + Math.min(data.end, recordLength)) / 2))
            .attr("y2", labelLineTop);
        const dy = (parseInt(data.anchor.split("c")[1], 10) % 2 === 0 ? "2" : "-1.2") + "em";
        group.append("text")
            .attr("x", recordScale(data.start + (Math.min(data.end, recordLength) - data.start) / 2))
            .attr("y", 20)
            .attr("font-size", "xx-small")
            .attr("class", "minimap-region-label")
            .attr("text-anchor", "middle")
            .attr("dy", dy)
            .text(data.anchor.split("c")[1]);

        // normal regions can stop here
        if (data.end <= recordLength) {
            return;
        }
        // cross-origin regions need more components:
        // with another rect
        group.append("rect")
            .attr("class", `minimap-region ${data.cssClass}`)
            .attr("y", 15)
            .attr("x", recordScale(0))
            .attr("width", recordScale(data.end) - recordScale(recordLength))
            .attr("height", barHeight)
            .style("stroke", "none");
        // the partial borders for the rects
        group.append("path")
            .attr("class", `minimap-region ${data.cssClass}`)
            .style("fill", "none")
            .style("stroke", "black")
            .attr("d", () => {
                const border = path();
                // open left for start
                border.moveTo(recordScale(0), 15);
                border.lineTo(recordScale(0) + recordScale(data.end) - recordScale(recordLength), 15);
                border.lineTo(recordScale(0) + recordScale(data.end) - recordScale(recordLength), 25);
                border.lineTo(recordScale(0), 25);
                // open right for end
                border.moveTo(recordScale(recordLength), 15);
                border.lineTo(recordScale(data.start), 15);
                border.lineTo(recordScale(data.start), 25);
                border.lineTo(recordScale(recordLength), 25);
                return border.toString();
            });
        // a duplicated label for that extra rect
        const labelX = recordScale((data.end % recordLength) / 2);
        group.append("line")
            .attr("class", "minimap-region-label-line centerline")
            .attr("x1", labelX)
            .attr("y1", labelLineBottom)
            .attr("x2", labelX)
            .attr("y2", labelLineTop);
        group.append("text")
            .attr("x", labelX)
            .attr("y", 20)
            .attr("font-size", "xx-small")
            .attr("class", "minimap-region-label")
            .attr("text-anchor", "middle")
            .attr("dy", dy)
            .text(data.anchor.split("c")[1]);
    });

    container.selectAll("text.minimap-region-label")
        .data(regions)
        .enter()
        .append("text")
        .attr("x", (data) => recordScale((data.start + data.end) / 2))
        .attr("y", 20)
        .attr("font-size", "xx-small")
        .attr("class", "minimap-region-label")
        .attr("text-anchor", "middle")
        .attr("dy", (data) => (parseInt(data.anchor.split("c")[1], barHeight) % 2 === 0 ? "2" : "-1.2") + "em")
        .text((data) => data.anchor.split("c")[1]);

}

/**
 * Creates overview SVGs for each of the given records
 *
 * @param records - the records for which to draw SVGs for
 */
export function createRecordOverviews(records: IRecord[]): void {
    let i = 0; // records are 1-indexed in user facing world
    for (const record of records) {
        i += 1;
        if (record.regions.length === 0) {  // skip empty records
            continue;
        }
        createRecordOverview(i, record.regions, record.length);
    }
}

/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {scaleLinear as d3scaleLinear} from "d3-scale";
import {event as d3event, select as d3select} from "d3-selection";

import {IRecord, IRegion} from "./dataStructures.js";

function createRecordOverview(record: number, regions: IRegion[], recordLength: number): void {
    if (regions.length === 0) {
        return;
    }
    const height = 40;
    const width = 810;

    const container = d3select(`#record-minimap-${record}`);
    container
        .attr("width", width)
        .attr("height", height);

    const recordScale = d3scaleLinear()
        .domain([0, recordLength])
        .range([0, width - 10]);

    container.append("line")
        .attr("x1", 0)
        .attr("y1", 20)
        .attr("x2", width - 10)
        .attr("y2", 20)
        .attr("class", "minimap-record-end centerline");

    container.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", height)
        .attr("class", "minimap-record-end centerline");

    container.append("line")
        .attr("x1", width - 10)
        .attr("y1", 0)
        .attr("x2", width - 10)
        .attr("y2", height)
        .attr("class", "centerline");

    container.selectAll("line.minimap-region-label-line")
        .data(regions)
        .enter()
        .append("line")
        .attr("class", "minimap-region-label-line centerline")
        .attr("x1", (data) => recordScale((data.start + data.end) / 2))
        .attr("y1", (data) => parseInt(data.anchor.split("c")[1], 10) % 2 === 0 ? 25 : 15)
        .attr("x2", (data) => recordScale((data.start + data.end) / 2))
        .attr("y2", (data) => parseInt(data.anchor.split("c")[1], 10) % 2 === 0 ? 30 : 10);

    container.selectAll("rect.minimap-region")
        .data(regions)
        .enter()
        .append("rect")
        .attr("class", (data) => "minimap-region " + (data.product_categories.length > 1 ? "hybrid" : data.product_categories[0]))
        .attr("y", 15)
        .attr("x", (data) => recordScale(data.start))
        .attr("width", (data) => recordScale(data.end - data.start))
        .attr("height", 10)
        .style("stroke", "black");

    container.selectAll("text.minimap-region-label")
        .data(regions)
        .enter()
        .append("text")
        .attr("x", (data) => recordScale((data.start + data.end) / 2))
        .attr("y", 20)
        .attr("font-size", "xx-small")
        .attr("class", "minimap-region-label")
        .attr("text-anchor", "middle")
        .attr("dy", (data) => (parseInt(data.anchor.split("c")[1], 10) % 2 === 0 ? "2" : "-1.2") + "em")
        .text((data) => data.anchor.split("c")[1]);

}

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

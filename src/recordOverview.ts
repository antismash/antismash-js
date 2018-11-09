/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {scaleLinear as d3scaleLinear} from "d3-scale";
import {event as d3event, select as d3select} from "d3-selection";

import {IRegion} from "./dataStructures.js";

function createRecordOverview(record: number, regions: IRegion[]): void {
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
        .domain([0, regions[regions.length - 1].end])
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
        .attr("class", (data) => "minimap-region " + (data.products.length > 1 ? "hybrid" : data.products[0]))
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

export function createRecordOverviews(allRegions: any): void {
    // step 1, gather regions by record
    const byRecord: IRegion[][] = [];
    for (const regionName of allRegions.order) {
        const regionNumber = parseInt(regionName.split("c")[0].substring(1), 10);  // "r2c5" -> 2
        while (byRecord.length <= regionNumber) {
            byRecord.push([]);
        }
        byRecord[regionNumber].push(allRegions[regionName]);
    }
    // step 2, build each svg
    for (let i = 0; i < byRecord.length; i++) {
        if (byRecord[i].length > 0) {
            createRecordOverview(i, byRecord[i]);
        }
    }
}

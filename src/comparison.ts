/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {scaleLinear as d3scaleLinear} from "d3-scale";
import {select as d3select} from "d3-selection";
import {IOrf, IRegion} from "./dataStructures.js";
import {selectOrfsByLoci, tag_to_id} from "./viewer.js";

let pbData: any = null;
let region: IRegion | null = null;

export function setComparisonData(anchor: string, results: any, regionData: IRegion) {
    pbData = results;
    region = regionData;
    for (const db in results) {
        if (results.hasOwnProperty(db)) {
            comparisonDetailHandler(anchor, db);
        }
    }
}

function geneArrowPoints(orf: IOrf, scale: any, orfY: number, orfHeight: number, reversed?: boolean): string {
    const upper: number = orfY + orfHeight / 2;
    const lower: number = orfY - orfHeight / 2;
    const middle: number = orfY;
    if (reversed) {
        if (orf.strand === 1) {
            const start: number = Math.floor(scale(orf.start));
            const boxEnd: number = Math.floor(Math.min(scale(orf.end) + orfHeight / 2, start));
            const pointEnd: number = Math.floor(scale(orf.end));
            return `${start},${upper} ${boxEnd},${upper} ${pointEnd},${middle} ${boxEnd},${lower} ${start},${lower}`;
        }
        if (orf.strand === -1) {
            const pointStart = Math.floor(scale(orf.start));
            const end = Math.floor(scale(orf.end));
            const boxStart = Math.floor(Math.max(scale(orf.start) - orfHeight / 2, end));
            return `${pointStart},${middle} ${boxStart},${upper} ${end},${upper} ${end},${lower} ${boxStart},${lower}`;
        }
        return `${orf.start},${upper} ${orf.end},${upper} ${orf.end},${lower} ${orf.start},${lower}`;
    }
    if (orf.strand === 1) {
        const start: number = Math.floor(scale(orf.start));
        const boxEnd: number = Math.floor(Math.max(scale(orf.end) - orfHeight / 2, start));
        const pointEnd: number = Math.floor(scale(orf.end));
        return `${start},${upper} ${boxEnd},${upper} ${pointEnd},${middle} ${boxEnd},${lower} ${start},${lower}`;
    }
    if (orf.strand === -1) {
        const pointStart = Math.floor(scale(orf.start));
        const end = Math.floor(scale(orf.end));
        const boxStart = Math.floor(Math.min(scale(orf.start) + orfHeight / 2, end));
        return `${pointStart},${middle} ${boxStart},${upper} ${end},${upper} ${end},${lower} ${boxStart},${lower}`;
    }
    return `${orf.start},${upper} ${scale(orf.end)},${upper} ${scale(orf.end)},${lower} ${scale(orf.start)},${lower}`;
}

function drawSVG(chart: any, svgID: string, reference: string, referenceData: any): void {
    if (referenceData === null || region === null) {
        return;
    }
    const labelHeight = 18;
    const height = 128 + labelHeight;
    const topOrfY = height * 0.25 + labelHeight;
    const bottomOrfY = height * 0.75;
    const orfHeight = 10;
    const width = region.end - region.start;
    const regionNumber = region.idx;
    const scale = d3scaleLinear()
        .domain([region.start, region.end])
        .range([0, 800]);
    let refScale = d3scaleLinear()
        .domain([referenceData.start, referenceData.end])
        .range([0, 800]);
    if (referenceData.reverse) {
        refScale = d3scaleLinear()
            .domain([referenceData.end, referenceData.start])
            .range([0, 800]);
    }

    chart.attr("viewport", `0 ${height + labelHeight} 0 ${width}`)
        .attr("height", height + labelHeight)
        .attr("width", 800);

    chart.append("text")
        .attr("x", 0)
        .attr("y", 20)
        .attr("text-anchor", "start")
        .text("Query");
    chart.append("text")
        .attr("x", 0)
        .attr("y", height + labelHeight / 2)
        .attr("text-anchor", "start")
        .text(`Reference: ${svgID.indexOf("-mibig-") > -1 ? reference.split(":")[0] : reference}`);

    // ORF centerlines
    chart.append("line")
        .attr("x1", 0)
        .attr("y1", topOrfY)
        .attr("x2", width)
        .attr("y2", topOrfY)
        .attr("class", "centerline");
    chart.append("line")
        .attr("x1", 0)
        .attr("y1", bottomOrfY)
        .attr("x2", width)
        .attr("y2", bottomOrfY)
        .attr("class", "centerline");

    // linkage lines
    const links: d3.Selection<SVGLineElement, any, any, any> = chart.selectAll("line.link")
        .data(referenceData.links)
        .enter().append("line")
        .attr("x1", (d: any) => scale(d.query_loc))
        .attr("y1", topOrfY + orfHeight / 2)
        .attr("x2", (d: any) => refScale(d.subject_loc))
        .attr("y2", bottomOrfY - orfHeight / 2)
        .attr("class", "link")
        .attr("class", "centerline");

    // ORFs
    const orfs: d3.Selection<SVGGElement, IOrf, any, any> = chart.selectAll("g.cc-svg-orf-group")
        .data(region.orfs)
        .enter().append("g").attr("class", "cc-svg-orf-group");
    // hide the ORF centerline
    orfs.append("polygon")
        .attr("points", (d) => geneArrowPoints(d, scale, topOrfY, orfHeight))
        .attr("class", "cc-svg-orf-bg")
        .attr("id", (d) => `${svgID}-${tag_to_id(d.locus_tag)}-bg`)
        .style("fill", "white");
    // draw the ORF itself
    orfs.append("polygon")
        .attr("points", (d) => geneArrowPoints(d, scale, topOrfY, orfHeight))
        .attr("class", (d) => `cc-svg-orf svgene-type-${d.type}`)
        .attr("id", (d) => `${svgID}-${tag_to_id(d.locus_tag)}`)
        .attr("opacity", "1")
        .attr("data-locus", (d) => d.locus_tag);

    // ORF labels
    const locusTags: d3.Selection<SVGTextElement, IOrf, any, any> = chart.selectAll("text.svgene-locustag")
        .data(region.orfs)
        .enter().append("text")
        // to prevent truncating locus tags, right-align labels after the midpoint
        .attr("x", (d: IOrf) => scale(d.start) < width / 2 ? scale(d.start) : scale(d.end))
        .attr("text-anchor", (d: IOrf) => scale(d.start) < width / 2 ? "start" : "end")
        .attr("y", topOrfY - labelHeight)
        .attr("class", "cc-svg-locustag")
        .attr("id", (d: IOrf) => `${svgID}-${tag_to_id(d.locus_tag)}-tag`)
        .text((d: IOrf) => d.locus_tag);

    // reference data
    const refOrfs: d3.Selection<SVGGElement, any, any, any> = chart.selectAll("g.cc-svg-reforf-group")
        .data(referenceData.genes)
        .enter().append("g").attr("class", "cc-svg-reforf-group");
    // hide the ORF centerline
    refOrfs.append("polygon")
        .attr("points", (d) => geneArrowPoints(d, refScale, bottomOrfY, orfHeight, referenceData.reverse))
        .attr("class", "cc-svg-reforf-bg")
        .attr("id", (d) => `${svgID}-ref${tag_to_id(d.locus_tag)}-bg`)
        .style("fill", "white");
    // draw the ORF itself
    refOrfs.append("polygon")
        .attr("points", (d) => geneArrowPoints(d, refScale, bottomOrfY, orfHeight, referenceData.reverse))
        .attr("class", (d) => `cc-svg-reforf svgene-type-${d.function}`)
        .attr("id", (d) => `${svgID}-ref${tag_to_id(d.locus_tag)}`)
        .attr("data-locus", (d) => d.locus_tag)
        .style("opacity", (d) => d.linked[`${regionNumber}`] ? "1" : "0.5");
    // ORF labels
    const refTags: d3.Selection<SVGTextElement, IOrf, any, any> = chart.selectAll("text.svgene-locustag")
        .data(referenceData.genes)
        .enter().append("text")
        // to prevent truncating locus tags, right-align labels after the midpoint
        .attr("x", (d: IOrf) => refScale(d.start) < width / 2 ? refScale(d.start) : refScale(d.end))
        .attr("text-anchor", (d: IOrf) => refScale(d.end) < width / 2 ? "start" : "end")
        .attr("y", bottomOrfY + labelHeight)
        .attr("class", "cc-svg-locustag")
        .attr("id", (d: IOrf) => `${svgID}-ref${tag_to_id(d.locus_tag)}-tag`)
        .text((d: IOrf) => d.locus_tag);
}

function comparisonDetailHandler(parentID: string, db: string): void {
    const anchor = window.location.hash.substring(1);
    const select = document.getElementById(`comparison-${db}-${anchor}-selector`) as HTMLInputElement;
    if (!select || !select.value) {
        return;
    }
    const rows = $(`#${parentID} * .heat-row-${db}`);
    rows.off("click").click(function() {
        $(`.heat-row-${db}`).css("border", "");
        $(this).css("border", "1px solid black");
        const originator = $(this);
        const svgID = `comparison-${db}-${anchor}-svg`;
        $(`#${svgID}`).remove();
        const chart = d3select(`#comparison-${db}-${anchor}`).append("svg")
            .attr("width", "100%")
            .attr("id", svgID);
        const data = pbData[db][select.value];
        const refClusterName = originator.attr("data-accession");
        if (!refClusterName) {
            return;
        }
        drawSVG(chart, svgID, refClusterName, data.reference_clusters[refClusterName]);
        createHandlers();
    });
    rows.first().click();
}

function createHandlers() {
    $(".cc-svg-orf").mouseover(function(e) {
        const id = $(this).attr("id");
        if (typeof id === "undefined") {
            return;
        }
        $(`#${id}-tag`).show();
    }).mouseout(function(e) {
        const id = $(this).attr("id");
        if (typeof id === "undefined") {
            return;
        }
        $(`#${id}-tag`).hide();
    }).click(function(e) {
        const locus = $(this).attr("data-locus");
        if (!locus) {
            return;
        }
        selectOrfsByLoci([locus], e.ctrlKey || e.metaKey);
    });
    $(".cc-svg-reforf").mouseover(function(e) {
        const id = $(this).attr("id");
        if (typeof id === "undefined") {
            return;
        }
        $(`#${id}-tag`).show();
    }).mouseout(function(e) {
        const id = $(this).attr("id");
        if (typeof id === "undefined") {
            return;
        }
        $(`#${id}-tag`).hide();
    });
}

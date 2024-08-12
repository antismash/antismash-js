/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */
import {scaleLinear as d3scaleLinear} from "d3-scale";
import {event as d3event, select as d3select} from "d3-selection";

import {IOrf, IRegion} from "./classes/pythonStructures.js";
import {selectOrfsByLoci, tag_to_id} from "./viewer.js";
import {replaceWildcardsInText} from "./wildcards.js";

let currentData: IAllResults | null = null;
let region: IRegion | null = null;

const labelHeight = 16;
const defaultOrfHeight = 10;
const textMargin = 10;

interface IClusterblastOrf {
    readonly locus_tag: string;
    readonly start: number;
    readonly end: number;
    readonly strand: number;
    readonly product: string;
    readonly real_start: number;
    readonly real_end: number;
}

interface IOrfMatch {
    readonly query: string;
    readonly pid: number;
    readonly coverage: number;
}

interface IReferenceOrf extends IClusterblastOrf {
    readonly matches: IOrfMatch[];
    readonly colour: string;
}

interface IReferenceCluster {
    readonly accession: string;
    readonly unique_name: string;
    readonly label: string;
    readonly product: string;
    readonly start: number;
    readonly end: number;
    readonly genes: IReferenceOrf[];
    readonly real_start: number;
    readonly real_end: number;
    reverse: boolean;
}

interface IVariantResults {
    readonly variant_name: string;
    readonly url: string;
    readonly matches: IReferenceCluster[];
    readonly query_colours: { [locusTag: string]: string };
}

interface IQueryCluster {
    readonly start: number;
    readonly end: number;
    readonly genes: IClusterblastOrf[];
    readonly gene_by_name: { [locusTag: string]: IClusterblastOrf };
}

interface IAllResults {
    readonly query: IQueryCluster;
    readonly references: IVariantResults[];
    readonly reference_names: string[];
}

/**
 * Sets the globals and handlers for the given region and its data
 *
 * @param anchor - the identifier for the region (e.g. 'r1c1')
 * @param results - the region's clusterblast data
 * @param regionData - the generic data for the region
 */
export function setClusterblastData(anchor: string, results: IAllResults, regionData: IRegion) {
    currentData = results;
    region = regionData;
    $(".cb-svg").remove();
    $(".clusterblast-orf-tooltip").hide();
    drawClusterblast();
}

/**
 * Creates, populates, and adds a handler for a div containing the label of a reference ORF.
 *
 * @param parentID - the parent ID of the element containing the full visualisation for the antiSMASH region
 * @param text - the text to draw within the label
 * @param element - the element for which the label should be shown relative to
 */
function showLabel(parentID: string, text: string, element: JQuery<HTMLElement>): void {
    $("#cb-current-label").remove();
    const label = $("<div>");
    label.addClass("clusterblast-locustag");
    label.attr("id", "cb-current-label");
    if (text) {
        label.text(text);
    } else {
        label.text("unknown");
    }
    let offset = element.offset();
    if (typeof offset === "undefined") {
        offset = {
            left: 0,
            top: 0,
        };
    }
    label.css("top", offset.top - 30);
    label.css("left", offset.left - 15);
    $(`#${parentID}`).parent().append(label);
    label.show();
}

function hideLabel() {
    $("#cb-current-label").remove();
}

/**
 * The handler for reference ORFs to temporarily show tooltips for the ORF that
 * was clicked.
 *
 * @param orf - the ORF that was clicked
 * @param x - the X-coordinate to use for the left side of the tooltip
 * @param y - the Y-coordinate to use for the top of the tooltip
 * @param variant - the name of the currently displayed database variant
 */
function tooltipHandler(orf: IReferenceOrf, x: number, y: number, variant: string): void {
    if (!region) {
        return;
    }
    const anchor = region.anchor;
    const tooltip = $(`#${variant}-${anchor}-orf-tooltip`);
    clearTimeout(tooltip.data("timeout"));
    tooltip.hide();
    tooltip.find(".clusterblast-tooltip-locus").html(orf.locus_tag);
    tooltip.find(".clusterblast-tooltip-product").html(orf.product);
    tooltip.find(".clusterblast-tooltip-location").html(`${orf.real_start} - ${orf.real_end}`);
    const matchElements = tooltip.find(".clusterblast-tooltip-matches");
    matchElements.find(".cb-tooltip-table-cell").remove();
    if (orf.matches.length < 1) {
        matchElements.hide();
    } else {
        const divLeader = '<div class="cb-tooltip-table-cell';
        for (const match of orf.matches) {
            matchElements.append(`${divLeader} cb-tooltip-table-locus">${match.query}</div>`);
            matchElements.append(`${divLeader} cb-tooltip-table-numeric">${match.pid}%</div>`);
            matchElements.append(`${divLeader} cb-tooltip-table-numeric">${match.coverage}%</div>`);
        }
        matchElements.show();
    }
    tooltip.css("top", y).css("left", x).show();
    let timeout = setTimeout(() => tooltip.slideUp("fast"), 5000);
    tooltip.css("top", y)
        .css("left", x)
        .show()
        .click(function() {$(this).hide(); })
        .data("timeout", timeout)
        .mouseover(() => clearTimeout(tooltip.data("timeout")))
        .mouseout(() => {
            clearTimeout(tooltip.data("timeout"));
            timeout = setTimeout(() => tooltip.slideUp("fast"), 5000);
            tooltip.data("timeout", timeout);
        });
}

/**
 * Creates the SVG path components that visualise the given ORF
 *
 * @param orf - the ORF data
 * @param scale - the d3 scale with which to map nucleotide coordinates to SVG coordinates
 * @param centerline - the vertical mid-point of the arrow
 * @param orfHeight - the full height to use for the arrow
 * @param reversed - whether this gene is on the reverse strand or not
 */
function geneArrowPoints(orf: IClusterblastOrf, scale: any, centerline: number,
                         orfHeight: number, reversed: boolean = false): string {
    const upper: number = centerline + orfHeight / 2;
    const lower: number = centerline - orfHeight / 2;
    const orfStart = scale(orf.start);
    const orfEnd = scale(orf.end);
    if (reversed) {
        if (orf.strand === 1) {
            const start: number = Math.floor(orfStart);
            const boxEnd: number = Math.floor(Math.min(orfEnd + orfHeight / 2, start));
            const pointEnd: number = Math.floor(orfEnd);
            return `${start},${upper} ${boxEnd},${upper} ${pointEnd},${centerline} ${boxEnd},${lower} ${start},${lower}`;
        }
        if (orf.strand === -1) {
            const pointStart = Math.floor(orfStart);
            const end = Math.floor(orfEnd);
            const boxStart = Math.floor(Math.max(orfStart - orfHeight / 2, end));
            return `${pointStart},${centerline} ${boxStart},${upper} ${end},${upper} ${end},${lower} ${boxStart},${lower}`;
        }
        return `${orfStart},${upper} ${orfEnd},${upper} ${orfEnd},${lower} ${orfStart},${lower}`;
    }
    if (orf.strand === 1) {
        const start: number = Math.floor(orfStart);
        const boxEnd: number = Math.floor(Math.max(orfEnd - orfHeight / 2, start));
        const pointEnd: number = Math.floor(orfEnd);
        return `${start},${upper} ${boxEnd},${upper} ${pointEnd},${centerline} ${boxEnd},${lower} ${start},${lower}`;
    }
    if (orf.strand === -1) {
        const pointStart = Math.floor(orfStart);
        const end = Math.floor(orfEnd);
        const boxStart = Math.floor(Math.min(orfStart + orfHeight / 2, end));
        return `${pointStart},${centerline} ${boxStart},${upper} ${end},${upper} ${end},${lower} ${boxStart},${lower}`;
    }
    return `${orfStart},${upper} ${orfEnd},${upper} ${orfEnd},${lower} ${orfStart},${lower}`;
}

function drawReference(chart: any, referenceData: IReferenceCluster, centerline: number, width: number,
                       imageWidth: number, svgID: string, bufferSize: number,
                       referenceURL: string, variant: string, orfHeight: number = defaultOrfHeight) {
    if (!region) {
        return;
    }
    const anchor = region.anchor;
    // the text should be above the top of the genes
    // with padding proportional to the ext height
    const textY = centerline - Math.floor((orfHeight + labelHeight) / 2);

    // add a large background so reversal interactions don't need such precise clicking
    const background = chart.append("rect")
        .attr("x", 0)
        .attr("y", textY - labelHeight) // up to the top of the text
        .attr("width", imageWidth) // the full extent of the centerline, not just text
        .attr("height", orfHeight + labelHeight * 2)
        .style("opacity", "0");

    // accession, linked to whatever url is present
    let linkParent = chart;
    // but only if present will it be a link
    if (referenceURL) {
        const url = replaceWildcardsInText(referenceURL, referenceData);
        linkParent = chart.append("a").attr("xlink:href", url);
    }
    // either way, a text element needs to exist for the description
    linkParent.append("text")
        .attr("x", textMargin)
        .attr("y", textY)
        .attr("text-anchor", "start")
        .attr("class", "clusterblast-acc")
        .text(referenceData.label);
    // products
    chart.append("text")
        .attr("x", imageWidth - textMargin)
        .attr("y", textY)
        .attr("text-anchor", "end")
        .attr("class", "clusterblast-acc")
        .text(referenceData.product);
    chart.append("line")
        .attr("x1", 0)
        .attr("y1", centerline)
        .attr("x2", imageWidth)
        .attr("y2", centerline)
        .attr("class", "centerline");
    const start = referenceData.start - bufferSize;
    const end = referenceData.end + bufferSize;
    const scale = d3scaleLinear()
        .domain([start, end])
        .range([0, imageWidth]);

    function refreshScaleDomain() {
        if (referenceData.reverse) {
            scale.domain([end, start]);
        } else {
            scale.domain([start, end]);
        }
    }

    refreshScaleDomain();

    const refOrfs: d3.Selection<SVGGElement, IReferenceOrf, any, any> = chart.selectAll("g.cb-svg-reforf-group")
        .data(referenceData.genes)
        .enter()
        .append("g").attr("class", "cb-svg-reforf-group");
    // draw the ORF itself
    refOrfs.append("polygon")
        .attr("points", (d) => geneArrowPoints(d, scale, centerline, orfHeight, referenceData.reverse))
        .attr("class", (d) => "cb-svg-orf cb-svg-reforf svgene-type-other")
        .attr("id", (d, i) => `${referenceData.accession.replace(".", "-")}-orf-${i}`)
        .attr("data-locus", (d) => d.locus_tag)
        .style("fill", (d) => d.colour)
        .on("click", (d) => tooltipHandler(d, d3event.pageX + 15, d3event.pageY + 15, variant))
        .on("mouseenter", (d, i) => showLabel(svgID, d.locus_tag, $(`#${referenceData.accession.replace(".", "-")}-orf-${i}`)))
        .on("mouseleave", (d) => hideLabel());

    function redraw() {
        $(`#${variant}-${anchor}-orf-tooltip`).hide();
        referenceData.reverse = !referenceData.reverse;
        refreshScaleDomain();
        refOrfs.select("polygon")
            .transition().duration(750)
            .attr("points", (d) => geneArrowPoints(d, scale, centerline, orfHeight, referenceData.reverse));
    }

    background.on("dblclick", redraw);
    refOrfs.on("dblclick", redraw);
}

/**
 * Adds all the relevant component elements to the the given SVG element, with the given reference data
 *
 * @param chart - the SVG element to add components to
 * @param svgID - the id of the container element for use in other generated IDs
 * @param query - the query data
 * @param data - the reference data for the variant being drawn
 * @param variantName - the name of the variant to be drawn
 * @param specificReference - an optionally provided single reference to draw, otherwise all references are drawn
 * @param orfHeight - if provided, overrides the default height of drawn ORFs
 */
function drawSVG(chart: any, svgID: string, query: IQueryCluster, data: IVariantResults, variantName: string,
                 specificReference?: IReferenceCluster, orfHeight: number = defaultOrfHeight): void {
    if (region === null) {
        return;
    }
    let referencesToDraw = [];
    if (specificReference) {
        referencesToDraw.push(specificReference);
    } else {
        referencesToDraw = data.matches.slice();
    }
    const width = region.end - region.start;
    const maxLength = Math.max(width, Math.max(...referencesToDraw.map((r) => (r.end - r.start))));
    const startHeight = 128 + labelHeight;
    // the distance between each reference centerline has to fit
    // space for the label, the gene height, and padding to separate it
    const interClusterGap = labelHeight * 2.5 + orfHeight;
    const fullHeight = startHeight + interClusterGap * (referencesToDraw.length - 1);
    let centerline = startHeight * 0.25;
    const regionNumber = region.idx;
    const imageWidth = 800;
    const trimmedStart = region.orfs.reduce((prev, curr) => prev.start < curr.start ? prev : curr).start;
    const trimmedEnd = region.orfs.reduce((prev, curr) => prev.start > curr.start ? prev : curr).end;
    const queryBufferSize = 0.5 * (maxLength - (trimmedEnd - trimmedStart));
    const scale = d3scaleLinear()
        .domain([trimmedStart - queryBufferSize, trimmedEnd + queryBufferSize])
        .range([0, imageWidth]);

    chart.attr("viewport", `0 ${fullHeight} 0 ${width}`)
        .attr("height", fullHeight)
        .attr("width", imageWidth);

    const queryGroup = chart.append("g").attr("class", "cb-query-group");

    queryGroup.append("text")
        .attr("x", textMargin)
        .attr("y", labelHeight)
        .attr("text-anchor", "start")
        .attr("class", "clusterblast-acc")
        .text("Query sequence");

    // ORF centerline
    queryGroup.append("line")
        .attr("x1", 0)
        .attr("y1", centerline)
        .attr("x2", imageWidth)
        .attr("y2", centerline)
        .attr("class", "centerline");

    // ORFs
    const orfs: d3.Selection<SVGGElement, IClusterblastOrf, any, any> = queryGroup.selectAll("g.cb-svg-orf-group")
        .data(region.orfs)
        .enter().append("g").attr("class", "cb-svg-orf-group");
    // draw each ORF
    orfs.append("polygon")
        .attr("points", (d) => geneArrowPoints(d, scale, centerline, orfHeight))
        .attr("class", (d) => `cb-svg-orf svgene-type-other`)
        .attr("id", (d) => `${svgID}-${tag_to_id(d.locus_tag)}`)
        .attr("opacity", "1")
        .style("fill", (d) => `${data.query_colours[d.locus_tag]}`)
        .attr("data-locus", (d) => d.locus_tag)
        .on("click", (d) => selectOrfsByLoci([d.locus_tag], false))
        .on("mouseenter", (d) => showLabel(svgID, d.locus_tag, $(`#${svgID}-${tag_to_id(d.locus_tag)}`)))
        .on("mouseleave", (d) => hideLabel());

    for (const referenceData of referencesToDraw) {
        centerline += interClusterGap;
        const bufferSize = 0.5 * (maxLength - (referenceData.end - referenceData.start));
        const subchart = chart.append("g").attr("id", `cb-ref-group-${referenceData.accession}`);
        drawReference(subchart, referenceData, centerline, width, imageWidth, svgID, bufferSize,
                      data.url, variantName);
    }
}

/**
 * Expected entry point from index.js, adds all the relevant handlers.
 *
 * Drawing will be deferred until the containing detail tab is shown.
 */
export function drawClusterblast() {
    if (!region || !currentData) {
        return;
    }
    const anchor = region.anchor;
    for (const variant of currentData.references) {
        const name = variant.variant_name;
        const section = $(`.body-details-header.${anchor}-${name}`);
        const tooltip = $(`#${name}-${anchor}-orf-tooltip`);
        section.on("click", () => tooltip.hide());
        section.off(".firstClick").one("click.firstClick", () => {
            const containerId = `${name}-${anchor}-svg`;
            $(containerId).empty();
            const chart = d3select(`#${containerId}`).append("svg")
                .attr("class", "cb-svg")
                .attr("width", "100%");
            const selector = $(`#${name}-${anchor}-select`);
            selector.off("change").change(function() {
                tooltip.hide();
                if (!currentData) {
                    return;
                }
                let accession = $(this).find(":selected").val();
                chart.selectAll("*").remove();
                // if "all" is selected, draw all references
                if (typeof accession !== "string" || accession === "all") {
                    accession = "";
                    drawSVG(chart, containerId, currentData.query, variant, name);
                    return;
                }
                // otherwise draw the single pair of query and reference that's selected
                for (const reference of variant.matches) {
                    if (reference.unique_name === accession) {
                        drawSVG(chart, containerId, currentData.query, variant, name, reference);
                        return;
                    }
                }
            });
            selector.change();
        });
    }
}

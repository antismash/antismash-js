/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {scaleLinear as d3scaleLinear} from "d3-scale";
import {select as d3select, selectAll as d3selectAll} from "d3-selection";

import {clipboardCopyConstruct, copyToClipboard} from "./clipboard.js";
import {IDomain, IDomainsOrf, IDomainsRegion} from "./dataStructures.js";
import {locusToFullId} from "./viewer.js";

let activeTooltip: JQuery<HTMLElement> | null;

const jsdomain = {
    text_height: 14,
    unique_id: 0,
    version: "0.0.1",
};

function addOrfDomainsToSVG(chart: any, orf: IDomainsOrf, position: number,
                            uniqueIndex: number, interOrfPadding: number,
                            singleOrfHeight: number, width: number, scale: d3.ScaleLinear<number, number>) {
    const currentOrfY = (singleOrfHeight + interOrfPadding) * position + 2; // +2 to fit the first
    const group = chart.append("g").attr("class", "domain-group");
    // label
    group.append("text")
        .text(orf.id)
        .attr("x", 0)
        .attr("y", currentOrfY + singleOrfHeight * 0.7)
        .attr("class", "jsdomain-orflabel")
        .attr("data-locus", orf.id);
    // centerline
    group.append("line")
      .attr("y1", currentOrfY + (singleOrfHeight / 2))
      .attr("y2", currentOrfY + (singleOrfHeight / 2))
      .attr("x1", scale(0))
      .attr("x2", scale(orf.sequence.length))
      .attr("class", "jsdomain-line");
    // startline
    group.append("line")
      .attr("x1", scale(0))
      .attr("x2", scale(0))
      .attr("y1", currentOrfY + singleOrfHeight / 4)
      .attr("y2", currentOrfY + singleOrfHeight * 3 / 4)
      .attr("class", "jsdomain-line");
    // endline
    group.append("line")
      .attr("x1", scale(orf.sequence.length))
      .attr("x2", scale(orf.sequence.length))
      .attr("y1", currentOrfY + singleOrfHeight / 4)
      .attr("y2", currentOrfY + singleOrfHeight * 3 / 4)
      .attr("class", "jsdomain-line");
    // individual domains
    group.selectAll("rect.jsdomain-domain")
        .data(orf.domains)
    .enter().append("rect")
        .attr("x", (d: IDomain) => scale(d.start))
        .attr("y", currentOrfY)
        .attr("rx", 17)
        .attr("ry", 17)
        .attr("width", (d: IDomain) => scale(d.end) - scale(d.start))
        .attr("height", singleOrfHeight)
        .attr("data-id", (d: IDomain, i: number) => `details-orf-${uniqueIndex}-${i}-tooltip`)
        .attr("class", (d: IDomain) => `jsdomain-domain ${d.html_class}`)
        .attr("stroke-width", 1);

    // individual domain text
    group.selectAll("text.jsdomain-text")
        .data(orf.domains)
    .enter().append("text")
        .text((d: IDomain) => d.abbreviation)
        .attr("x", (d: IDomain) => scale((d.start + d.end) / 2))
        .attr("text-anchor", "middle")
        .attr("y", currentOrfY + singleOrfHeight * 0.7)
        .attr("data-id", (d: IDomainsOrf, i: number) => `details-orf-${uniqueIndex}-${i}-tooltip`)
        .attr("class", "jsdomain-text")
        .attr("font-size", jsdomain.text_height)
        .attr("font-weight", "bold");
}

export function drawDomains(id: string, region: IDomainsRegion, height: number): void {
    const container = d3select(`#${id}`);
    const singleOrfHeight = height;
    const interOrfPadding = 10;
    const width = $(`#${id}`).width() || 700;
    container.selectAll("svg.jsdomain-svg").remove();
    container.selectAll("svg.jsdomain-svg-single").remove();
    const realHeight = (singleOrfHeight + interOrfPadding) * region.orfs.length + 10;
    const chart = container.append("svg")
        .attr("height", realHeight)
        .attr("width", "100%")
        .attr("viewbox", `-1 -1 ${width} ${realHeight}`)
        .attr("class", "jsdomain-svg");

    let maxOrfLength = 0;
    let longestName = "";
    for (const orf of region.orfs) {
        maxOrfLength = Math.max(maxOrfLength, orf.sequence.length);
        if (longestName.length < orf.id.length) {
            longestName = orf.id;
        }
    }

    // find the exact length of the longest ORF name
    const dummyLabel = chart.append("g").append("text")
        .text(longestName)
        .attr("x", 0)
        .attr("y", 0)
        .attr("id", "dummy-label");

    const maxNameWidth = (dummyLabel.node() as SVGTextElement).getComputedTextLength() || (longestName.length * 15);
    dummyLabel.remove();

    const x = d3scaleLinear()
      .domain([1, maxOrfLength * 1.02])  // pad slightly to allow for a clean end
      .range([maxNameWidth + 10, width]);  // allows space for labels

    const singles = container.append("div").attr("class", "jsdomain-svg-singles");

    for (let i = 0; i < region.orfs.length; i++) {
        const orf = region.orfs[i];
        const idx = jsdomain.unique_id++;

        // create a single feature SVG
        const singleSVG = singles.append("svg")
            .attr("height", singleOrfHeight + interOrfPadding * 0.5)  // since there's no second orf
            .attr("width", "100%")
            .attr("viewbox", `-1 -1 ${width} ${singleOrfHeight + interOrfPadding}`)
            .attr("class", "jsdomain-svg-single")
            .attr("id", `${locusToFullId(orf.id)}-domains`);
        // add the domain
        addOrfDomainsToSVG(singleSVG, orf, 0, idx, interOrfPadding, singleOrfHeight, width, x);
        addOrfDomainsToSVG(chart, orf, i, idx, interOrfPadding, singleOrfHeight, width, x);

        const toolGroup = container.append("div").attr("id", `details-orf-${idx}`);
        toolGroup.selectAll("div.jsdomain-tooltip")
            .data(orf.domains)
            .enter()
            .append("div")
                .attr("class", "jsdomain-tooltip")
                .attr("id", (d, j) => `details-orf-${idx}-${j}-tooltip`)
                .html((d) => generateTooltip(d, orf));
        $(".jsdomain-tooltip .clipboard-copy").off("click").click(copyToClipboard);
    }
    // label as selector as per viewer
    $(".jsdomain-orflabel").off("click").click(function(this: HTMLElement, event: JQuery.Event<HTMLElement, null>) {
        $(`#${locusToFullId($(this).attr("data-locus") || "none")}-svgeneorf`).trigger(event);
    });
    d3selectAll("g.domain-group").data(region.orfs);
    init();
    redrawDomains();
}

function generateTooltip(domain: IDomain, orf: IDomainsOrf) {
    let html = `${domain.type}<br>Location: ${domain.start}-${domain.end} AA<br>`;
    if (domain.napdoslink.length > 0) {
        html += `<a href="${domain.napdoslink}" target="_blank">Analyze with NaPDoS</a><br>`;
    }
    html += `<a href="${domain.blastlink}" target="_blank">Run BlastP on this domain</a><br>`;
    if (domain.predictions.length > 0) {
        html += "<dl><dt>Substrate predictions:</dt>";
        for (const prediction of domain.predictions) {
            html += `<dd>-${prediction[0]}: ${prediction[1]}</dd>`;
        }
        html += "</dl>";
    }
    html += `AA sequence: ${clipboardCopyConstruct(domain.sequence)}<br>`;
    if (domain.dna_sequence) {
        html += `Nucleotide sequence: ${clipboardCopyConstruct(domain.dna_sequence)}<br>`;
    }

    return html;
}

function tooltipHandler(this: HTMLElement, ev: JQuery.Event) {
    // hide any existing one
    const id = $(this).attr("data-id");
    if (typeof id === "undefined") {
        // we can't handle this
        return;
    }
    const tooltip = $(`#${id}`);
    if (activeTooltip) {
        clearTimeout(tooltip.data("timeout"));
        activeTooltip.hide();
    }

    // setup the new one
    activeTooltip = tooltip;

    if (tooltip.css("display") !== "none") {
        tooltip.hide();
        return;
    }
    let offset = $(this).offset();
    if (typeof offset === "undefined") {
        offset = {
            left: 0,
            top: 0,
        };
    }
    let timeout = setTimeout(() => tooltip.slideUp("fast"), 5000);
    tooltip.css("top", offset.top + 30)
        .css("left", offset.left + 10)
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

function init() {
    $(".jsdomain-domain").click(tooltipHandler);
    $(".jsdomain-text").click(function() {
        const id = $(this).attr("id");
        if (typeof id === "undefined") {
            return;
        }
        $(`#${id.replace("-text", "-domain")}`).click();
    });
    $(".jsdomain-textarea").click((event) => event.stopPropagation());
}

export function redrawDomains() {
    if ($("input.domains-selected-only").prop("checked")) {
        $(".jsdomain-svg").hide();
        $(".jsdomain-svg-singles").show();
    } else {
        $(".jsdomain-svg").show();
        $(".jsdomain-svg-singles").hide();
    }
}

export function createButtonHandlers() {
    $(".nrps-pks-domain-buttons * .button-like").off("click");
    $("input.domains-selected-only")
        .change(function() {
            // apply the change to all regions
            $("input.domains-selected-only").prop("checked", $(this).prop("checked"));
            redrawDomains();
        });
    $("input.domains-toggle-bg")
        .change(function() {
            const active = $(this).prop("checked");
            $(".domains-even").css("fill", active ? "" : "white");
            // and apply the change to all regions
            $("input.domains-toggle-bg").prop("checked", active);
        });
}

/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {Path, path} from "d3-path";
import {scaleLinear as d3scaleLinear} from "d3-scale";
import {select as d3select, selectAll as d3selectAll} from "d3-selection";
import {arc as d3arc} from "d3-shape";

import {clipboardCopyConstruct, copyToClipboard} from "./clipboard.js";
import {IDomain, IDomainsOrf, IDomainsRegion, IModule} from "./dataStructures.js";
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
    const currentOrfY = (singleOrfHeight + interOrfPadding) * position + 4; // +4 to fit the first
    const group = chart.append("g").attr("class", "domain-group");
    // label
    group.append("text")
        .text(orf.id)
        .attr("x", 0)
        .attr("y", currentOrfY + singleOrfHeight * 0.7)
        .attr("class", "jsdomain-orflabel")
        .attr("data-locus", orf.id);
    // module bases
    group.selectAll("rect.jsdomain-module")
        .data(orf.modules)
    .enter().append("rect")
        .attr("x", (d: IModule) => scale(d.start))
        .attr("y", currentOrfY - 3)
        .attr("width", (d: IModule) => scale(d.end) - scale(d.start))
        .attr("height", singleOrfHeight + 6)
        .attr("rx", 5)
        .attr("class", (d: IModule) => d.complete ? "jsdomain-module" : "jsdomain-module jsdomain-incomplete-module");

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

    // module lids
    const moduleLids = group.selectAll("g.jsdomain-module-lid")
        .data(orf.modules.filter((d) => d.complete))
    .enter().append("g")
        .attr("class", "jsdomain-module-lid");
    moduleLids.append("rect")
        .attr("x", (module: IModule) => scale(module.start))
        .attr("y", currentOrfY - 3)
        .attr("width", (module: IModule) => scale(module.end) - scale(module.start))
        .attr("height", singleOrfHeight + 6)
        .attr("rx", 5)
        .attr("class", "jsdomain-module-lid-body");
    moduleLids.append("text")
        .text((module: IModule) => module.monomer || "no prediction")
        .attr("x", (module: IModule) => scale((module.start + module.end) / 2))
        .attr("y", (module: IModule) => currentOrfY + singleOrfHeight * (module.iterative ? 0.5 : 0.7))
        .attr("text-anchor", "middle")
        .attr("class", "jsdomain-module-lid-text");

    const iterIcon: Path = path();  // this doesn't return itself for methods, so chaining won't work
    iterIcon.moveTo(50, 50);
    iterIcon.arc(0, 50, 50, 0, 45 * (Math.PI / 180), true);
    iterIcon.moveTo(50, 50);
    iterIcon.lineTo(10, 40);

    const detail = iterIcon.toString();

    moduleLids.append("path")
        .attr("d", detail)
        .attr("stroke", (module: IModule) => module.iterative ? "black" : "none")
        .attr("stroke-width", "5px")
        .attr("fill", "none")
        .attr("stroke-linecap", "round")
        .attr("transform", (module: IModule) => {
            const start: number = scale((module.start + module.end) / 2);
            const end: number = currentOrfY + singleOrfHeight * 0.6;
            return `translate(${start}, ${end}) scale(0.1, 0.1)`;
        });
}

export function drawDomains(id: string, region: IDomainsRegion, height: number): void {
    const container = d3select(`#${id}`);
    const singleOrfHeight = height;
    const interOrfPadding = 10;
    const width = $(`#${id}`).width() || 700;
    container.selectAll("svg.jsdomain-svg").remove();
    container.selectAll("svg.jsdomain-svg-single").remove();
    const realHeight = (singleOrfHeight + interOrfPadding) * region.orfs.length;
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

    const singleSVGHeight = singleOrfHeight + interOrfPadding * 0.8;
    for (let i = 0; i < region.orfs.length; i++) {
        const orf = region.orfs[i];
        const idx = jsdomain.unique_id++;

        // create a single feature SVG
        const singleSVG = singles.append("svg")
            .attr("height", singleSVGHeight)  // since there's no second orf
            .attr("width", "100%")
            .attr("viewbox", `-1 -1 ${width} ${singleSVGHeight}`)
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
    $(".jsdomain-module-lid").mouseenter(function() {
        $(this).hide();
    }).mouseleave(function() {
        $(this).show();
    });
}

export function redrawDomains() {
    if ($("input.domains-selected-only").prop("checked")) {
        $(".jsdomain-svg").hide();
        $(".jsdomain-svg-singles").show();
    } else {
        $(".jsdomain-svg").show();
        $(".jsdomain-svg-singles").hide();
    }
    if ($("input.show-module-domains").prop("checked")) {
        $(".jsdomain-module-lid").hide();
    } else {
        $(".jsdomain-module-lid").show();
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
    $("input.show-module-domains")
        .change(function() {
            // apply the change to all regions
            $("input.show-module-domains").prop("checked", $(this).prop("checked"));
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

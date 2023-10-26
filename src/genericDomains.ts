/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

/**
 * Visualisation functionality for generic domains, such as HMMer results of various databases,
 * which were detected by antiSMASH.
 * @module
 */

import {Path, path} from "d3-path";
import {scaleLinear as d3scaleLinear} from "d3-scale";
import {select as d3select, selectAll as d3selectAll} from "d3-selection";
import {arc as d3arc} from "d3-shape";

import {clipboardCopyConstruct, copyToClipboard} from "./clipboard.js";
import {IDomainsOrf, IDomainsRegion, IHmmerDomain, IModule} from "./dataStructures.js";
import {locusToFullId, zoom_to_selection} from "./viewer.js";

/** Options for generic domain drawing.
 */
export interface IDrawOptions {
    /** The region's anchor (e.g. "r1c1"). */
    anchor: string;
    /** Whether to completely reset/redraw the domains from scratch. */
    reset: boolean;
}

/** Information about the domains to display and the tool within antiSMASH that found them.
 */
export interface ITool {
    /** The name of the tool that detected the domains. */
    name: string;
    /** The domain data for ORFS to use in visualisation. */
    data: IDomainsOrf[];
    /** A URL to use as a base for building any links out to the database in question, if any. */
    url: string;
}

let activeTooltip: JQuery<HTMLElement> | null;

const jsdomain = {
    text_height: 14,
    unique_id: 0,
    version: "0.0.1",
};

let regionData: any = null;  // storage for multiple tools
let drawHeight: number = 25;

const DOMAIN_CLASS = "generic-domain";

/**
 * Adds an ORF and its domains to the given SVG.
 *
 *
 * @param chart - the SVG element
 * @param orf - the data on the ORF and its domains
 * @param position - the "row" of the ORF within the SVG
 * @param uniqueIndex - a unique index for all ORFs across all regions
 * @param interOrfPadding - the distance between ORFs rows in the SVG
 * @param singleOrfHeight - the height to use for the ORF row
 * @param width - the full width to use for the ORF domain visualisation
 * @param scale - the d3 scale to convert length in amino acids to pixels
 * @param tool - the tool data
 * @param alwaysShowText - whether or not to show the names of the domains regardless of size
 */
function addOrfDomainsToSVG(chart: any, orf: IDomainsOrf, position: number,
                            uniqueIndex: number, interOrfPadding: number,
                            singleOrfHeight: number, width: number, scale: d3.ScaleLinear<number, number>,
                            tool: ITool, alwaysShowText: boolean = false) {
    const currentOrfY = (singleOrfHeight + interOrfPadding) * position + 4; // +4 to fit the first
    const group = chart.append("g").attr("class", "domain-group");
    // label
    group.append("text")
        .text(orf.id)
        .attr("x", 0)
        .attr("y", currentOrfY + singleOrfHeight * 0.7)
        .attr("class", `${DOMAIN_CLASS}-orflabel`)
        .attr("data-locus", orf.id);

    // centerline
    group.append("line")
      .attr("y1", currentOrfY + (singleOrfHeight / 2))
      .attr("y2", currentOrfY + (singleOrfHeight / 2))
      .attr("x1", scale(0))
      .attr("x2", scale(orf.seqLength))
      .attr("class", `${DOMAIN_CLASS}-line`);
    // startline
    group.append("line")
      .attr("x1", scale(0))
      .attr("x2", scale(0))
      .attr("y1", currentOrfY + singleOrfHeight / 4)
      .attr("y2", currentOrfY + singleOrfHeight * 3 / 4)
      .attr("class", `${DOMAIN_CLASS}-line`);
    // endline
    group.append("line")
      .attr("x1", scale(orf.seqLength))
      .attr("x2", scale(orf.seqLength))
      .attr("y1", currentOrfY + singleOrfHeight / 4)
      .attr("y2", currentOrfY + singleOrfHeight * 3 / 4)
      .attr("class", `${DOMAIN_CLASS}-line`);
    // individual domains
    group.selectAll(`rect.${DOMAIN_CLASS}-domain`)
        .data(orf.domains)
    .enter().append("rect")
        .attr("x", (d: IHmmerDomain) => scale(d.start))
        .attr("y", currentOrfY)
        .attr("rx", 17)
        .attr("ry", 17)
        .attr("width", (d: IHmmerDomain) => scale(d.end) - scale(d.start))
        .attr("height", singleOrfHeight)
        .attr("data-id", (d: IHmmerDomain, i: number) => `${tool.name}-details-orf-${uniqueIndex}-${i}-tooltip`)
        .attr("class", (d: IHmmerDomain) => `${DOMAIN_CLASS}-domain ${d.html_class ? d.html_class : "generic-type-other"}`)
        .attr("stroke-width", (d: IHmmerDomain) => d.go_terms && d.go_terms.length > 0 ? 3 : 1);

    // individual domain text
    group.selectAll(`text.${DOMAIN_CLASS}-text`)
        .data(orf.domains)
    .enter().append("text")
        .text((d: IHmmerDomain) => {
            if (alwaysShowText) {
                return d.name;
            }
            const domainWidth = scale(d.end) - scale(d.start);
            const lower = (d.name.match(/[a-z]/g) || []).length;
            const upper = (d.name.match(/[A-Z]/g) || []).length;
            const punctuation = d.name.length - upper - lower;
            const size = upper * 16 + punctuation * 18 + lower * 8;
            return domainWidth > size ? d.name : "...";
        })
        .attr("x", (d: IHmmerDomain) => scale((d.start + d.end) / 2))
        .attr("text-anchor", "middle")
        .attr("y", currentOrfY + singleOrfHeight * 0.7)
        .attr("class", (d: IHmmerDomain) => `${DOMAIN_CLASS}-text ${d.html_class}`)
        .attr("font-size", jsdomain.text_height)
        .attr("font-weight", "bold");
}

/**
 * Expected entry point from index.js, adds all the relevant handlers.
 *
 * Drawing will be deferred until the containing detail tab is shown.
 */
export function drawGenericDomains(anchor: string, data: any, height: number): void {
    regionData = data;
    drawHeight = height;
    for (const tool of data) {
        $(`.${anchor}-${tool.name}-details`).off(".firstClick").one("click.firstClick", () => {
            actualDrawGenericDomains(`${anchor}-${tool.name}-details-svg`, tool, height);
        });
    }
}

/**
 * Deferred drawing of domains.
 *
 * @param id - the ID of the relevant DOM element
 * @param tool - the data to draw
 * @param height - the available height in which to draw the domains
 */
function actualDrawGenericDomains(id: string, tool: ITool, height: number): void {
    // if they already exist, don't draw them again
    if ($(`#${id}`).find(`svg.${DOMAIN_CLASS}-svg`).length > 0) {
        return;
    }
    const long = $(`input.domains-expand-full`).prop("checked");
    const container = d3select(`#${id}`);
    const singleOrfHeight = height;
    const interOrfPadding = 10;
    let width = $(`#${id}`).width() || 1200;
    const realHeight = (singleOrfHeight + interOrfPadding) * tool.data.length;
    const chart = container.append("svg")
        .attr("height", realHeight)
        .attr("width", width)  // for expanded mode this is just a placeholder and changes later
        .attr("class", `${DOMAIN_CLASS}-svg`);

    let maxOrfLength = 0;
    let longestName = "";
    for (const orf of tool.data) {
        maxOrfLength = Math.max(maxOrfLength, orf.seqLength || 0);
        if (longestName.length < orf.id.length) {
            longestName = orf.id;
        }
    }

    // find the exact length of the longest ORF name
    const dummyLabelGroup = chart.append("g");
    const dummyLabel = dummyLabelGroup.append("text")
        .text(longestName)
        .attr("x", 0)
        .attr("y", 0)
        .attr("id", "dummy-label");
    const maxNameWidth = (dummyLabel.node() as SVGTextElement).getComputedTextLength() || (longestName.length * 10);

    // if in expand mode, find the scaling required to fit every label into each domain
    if (long) {
        let factor = 0;
        dummyLabel.attr("class", `${DOMAIN_CLASS}-text`);
        for (const orf of tool.data) {
            for (const domain of orf.domains) {
                dummyLabel.text(domain.name);
                const length = domain.end - domain.start;
                const text = (dummyLabel.node() as SVGTextElement).getComputedTextLength();
                const current = text / length;
                if (current > factor) {
                    factor = current;
                }
            }
        }
        // update the width for scaling and presentation, but only if *more* space is required
        const required = factor * maxOrfLength;
        if (required > width) {
            width = required;
        }
        chart.attr("width", width)
          .attr("viewbox", `-1 -1 ${width} ${realHeight}`);
    }
    dummyLabelGroup.remove();

    const x = d3scaleLinear()
      .domain([1, maxOrfLength * 1.02])  // pad slightly to allow for a clean end
      .range([maxNameWidth + 10, width]);  // allows space for labels

    const singles = container.append("div").attr("class", `${DOMAIN_CLASS}-svg-singles`);

    const singleSVGHeight = singleOrfHeight + interOrfPadding * 0.8;
    for (let i = 0; i < tool.data.length; i++) {
        const orf = tool.data[i];
        const idx = jsdomain.unique_id++;

        // create a single feature SVG
        const fullId = locusToFullId(orf.id);
        const orfClass = `${fullId}-generic-domains`;
        const singleSVG = singles.append("svg")
            .attr("height", singleSVGHeight)  // since there's no second orf
            .attr("width", long ? width : "100%")
            .attr("viewbox", `-1 -1 ${width} ${singleSVGHeight}`)
            .attr("class", `${DOMAIN_CLASS}-svg-single ${orfClass}`);
        // add the domain
        addOrfDomainsToSVG(singleSVG, orf, 0, idx, interOrfPadding, singleOrfHeight, width, x, tool, long);
        addOrfDomainsToSVG(chart, orf, i, idx, interOrfPadding, singleOrfHeight, width, x, tool, long);

        // as these are created after genes can be selected, set the visibility if relevant
        // again, don't use JQuery for the class check because it's terrible with SVGs
        if (!$(`#${fullId}-svgeneorf`)[0].classList.contains("svgene-selected-orf")) {
            $(`.${orfClass}`).hide();
        }

        const toolGroup = container.append("div").attr("id", `${tool.name}-details-orf-${idx}`);
        toolGroup.selectAll(`div.${DOMAIN_CLASS}-tooltip`)
            .data(orf.domains)
            .enter()
            .append("div")
                .attr("class", `${DOMAIN_CLASS}-tooltip`)
                .attr("id", (d, j) => `${tool.name}-details-orf-${idx}-${j}-tooltip`)
                .html((d) => generateTooltip(d, tool.url));
        $(`.${DOMAIN_CLASS}-tooltip .clipboard-copy`).off("click").click(copyToClipboard);
    }
    // label as selector as per viewer
    $(`.${DOMAIN_CLASS}-orflabel`).off("click").click(function(this: HTMLElement, event: JQuery.Event<HTMLElement, null>) {
        $(`#${locusToFullId($(this).attr("data-locus") || "none")}-svgeneorf`).trigger(event);
        zoom_to_selection();
    });
    d3selectAll("g.domain-group").data(tool.data);
    init();
    redrawGenericDomains();
}

/**
 * Generates the tooltip for the given domain, including a URL if specified.
 *
 * @param domain - the domain for which to draw a tooltip
 * @param url - the url to use, with the wildcard `$ACCESSION` being replaced by
 *              the domain's accession
 */
function generateTooltip(domain: IHmmerDomain, url: string) {
    let html = `${domain.name}<br>`;
    if (url.length > 0) {
        const link = `<a class='external-link' target='_blank' href="${url.replace("$ACCESSION", domain.accession)}">${domain.accession}</a>`;
        if (domain.accession !== domain.name) {
            html = `${link} - ${domain.name}<br>`;
        } else {
            html = `${link}<br>`;
        }
    }
    html += `Location: ${domain.start}-${domain.end} AA<br>`;
    html += `Score: ${domain.score}, E-Value: ${domain.evalue}<br>`;
    html += `${domain.description}<br><br>`;
    if (domain.go_terms && domain.go_terms.length > 0) {
        html += "Gene Ontologies:<br>";
        for (const go of domain.go_terms) {
            html += `&nbsp;${go}<br>`;
        }
        html += "<br>";
    }

    return html;
}

/**
 * An event handler to show the tooltip for the bound element.
 *
 * @param ev - the event that triggered the handler
 */
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

/**
 * Sets the tooltip handlers for all domain elements.
 */
function init() {
    $(`.${DOMAIN_CLASS}-domain`).click(tooltipHandler);
}

/**
 * Redraws the ORF domain SVGs with the provided options.
 * Requires that region data is already set via {@link drawGenericDomains}.
 *
 * @param options - the options to use, if any
 */
export function redrawGenericDomains(options?: IDrawOptions) {
    if (options && options.reset) {
        // reset everything, including the first click handlers
        drawGenericDomains(options.anchor, regionData, drawHeight);

        for (const tool of regionData) {
            const prefix = `${options.anchor}-${tool.name}-details`;
            const id = `${prefix}-svg`;
            // remove all the existing SVGs, since they'll all be wrong
            $(`#${id}`).empty();
            // if a tab is active, then don't wait for the click, just draw straight away
            if ($(`.${prefix}`).hasClass("body-details-header-active")) {
                $(`.${prefix}`).off(".firstClick");
                actualDrawGenericDomains(`${prefix}-svg`, tool, drawHeight);
            }
        }
    }
    if ($(`input.domains-selected-only`).prop("checked")) {
        $(`.${DOMAIN_CLASS}-svg`).hide();
        $(`.${DOMAIN_CLASS}-svg-singles`).show();
    } else {
        $(`.${DOMAIN_CLASS}-svg`).show();
        $(`.${DOMAIN_CLASS}-svg-singles`).hide();
    }
}

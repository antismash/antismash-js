/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {Path, path} from "d3-path";
import {scaleLinear as d3scaleLinear} from "d3-scale";
import {select as d3select, selectAll as d3selectAll} from "d3-selection";
import {arc as d3arc} from "d3-shape";

import {clipboardCopyConstruct, copyToClipboard} from "./clipboard.js";
import {IDomainsRegion, IModule, IPfamDomain, IPfamsOrf} from "./dataStructures.js";
import {locusToFullId} from "./viewer.js";

let activeTooltip: JQuery<HTMLElement> | null;

const jsdomain = {
    text_height: 14,
    unique_id: 0,
    version: "0.0.1",
};

const DOMAIN_CLASS = "pfam-domain";

function addOrfDomainsToSVG(chart: any, orf: IPfamsOrf, position: number,
                            uniqueIndex: number, interOrfPadding: number,
                            singleOrfHeight: number, width: number, scale: d3.ScaleLinear<number, number>) {
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
        .data(orf.pfams)
    .enter().append("rect")
        .attr("x", (d: IPfamDomain) => scale(d.start))
        .attr("y", currentOrfY)
        .attr("rx", 17)
        .attr("ry", 17)
        .attr("width", (d: IPfamDomain) => scale(d.end) - scale(d.start))
        .attr("height", singleOrfHeight)
        .attr("data-id", (d: IPfamDomain, i: number) => `pfam-details-orf-${uniqueIndex}-${i}-tooltip`)
        .attr("class", (d: IPfamDomain) => `${DOMAIN_CLASS}-domain ${d.html_class}`)
        .attr("stroke-width", (d: IPfamDomain) => d.go_terms.length > 0 ? 3 : 1);

    // individual domain text
    group.selectAll(`text.${DOMAIN_CLASS}-text`)
        .data(orf.pfams)
    .enter().append("text")
        .text((d: IPfamDomain) => {
            const domainWidth = scale(d.end) - scale(d.start);
            const lower = (d.name.match(/[a-z]/g) || []).length;
            const upper = (d.name.match(/[A-Z]/g) || []).length;
            const punctuation = d.name.length - upper - lower;
            const size = upper * 16 + punctuation * 18 + lower * 8;
            return domainWidth > size ? d.name : "...";
        })
        .attr("x", (d: IPfamDomain) => scale((d.start + d.end) / 2))
        .attr("text-anchor", "middle")
        .attr("y", currentOrfY + singleOrfHeight * 0.7)
        .attr("class", (d: IPfamDomain) => `${DOMAIN_CLASS}-text ${d.html_class}`)
        .attr("font-size", jsdomain.text_height)
        .attr("font-weight", "bold");
}

export function drawPfamDomains(anchor: string, region: IDomainsRegion, height: number): void {
    $(`.${anchor}-pfam-details`).off(".firstClick").one("click.firstClick", () => {
        actualDrawPfamDomains(`${anchor}-pfam-details-svg`, region, height);
    });
}

function actualDrawPfamDomains(id: string, region: IDomainsRegion, height: number): void {
    // if they already exist, don't draw them again
    if ($(`#${id}`).find(`svg.${DOMAIN_CLASS}-svg`).length > 0) {
        return;
    }
    const container = d3select(`#${id}`);
    const singleOrfHeight = height;
    const interOrfPadding = 10;
    const width = $(`#${id}`).width() || 1200;
    const realHeight = (singleOrfHeight + interOrfPadding) * region.pfamOrfs.length;
    const chart = container.append("svg")
        .attr("height", realHeight)
        .attr("width", width)
        .attr("viewbox", `-1 -1 ${width} ${realHeight}`)
        .attr("class", `${DOMAIN_CLASS}-svg`);

    let maxOrfLength = 0;
    let longestName = "";
    for (const orf of region.pfamOrfs) {
        maxOrfLength = Math.max(maxOrfLength, orf.seqLength || 0);
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

    const maxNameWidth = (dummyLabel.node() as SVGTextElement).getComputedTextLength() || (longestName.length * 10);
    dummyLabel.remove();

    const x = d3scaleLinear()
      .domain([1, maxOrfLength * 1.02])  // pad slightly to allow for a clean end
      .range([maxNameWidth + 10, width]);  // allows space for labels

    const singles = container.append("div").attr("class", `${DOMAIN_CLASS}-svg-singles`);

    const singleSVGHeight = singleOrfHeight + interOrfPadding * 0.8;
    for (let i = 0; i < region.pfamOrfs.length; i++) {
        const orf = region.pfamOrfs[i];
        const idx = jsdomain.unique_id++;

        // create a single feature SVG
        const singleSVG = singles.append("svg")
            .attr("height", singleSVGHeight)  // since there's no second orf
            .attr("width", "100%")
            .attr("viewbox", `-1 -1 ${width} ${singleSVGHeight}`)
            .attr("class", `${DOMAIN_CLASS}-svg-single`)
            .attr("id", `${locusToFullId(orf.id)}-pfam-domains`);
        // add the domain
        addOrfDomainsToSVG(singleSVG, orf, 0, idx, interOrfPadding, singleOrfHeight, width, x);
        addOrfDomainsToSVG(chart, orf, i, idx, interOrfPadding, singleOrfHeight, width, x);

        // as these are created after genes can be selected, set the visibility if relevant
        // again, don't use JQuery for the class check because it's terrible with SVGs
        if (!$(`#${locusToFullId(orf.id)}-svgeneorf`)[0].classList.contains("svgene-selected-orf")) {
            $(`#${locusToFullId(orf.id)}-pfam-domains`).hide();
        }

        const toolGroup = container.append("div").attr("id", `pfam-details-orf-${idx}`);
        toolGroup.selectAll(`div.${DOMAIN_CLASS}-tooltip`)
            .data(orf.pfams)
            .enter()
            .append("div")
                .attr("class", `${DOMAIN_CLASS}-tooltip`)
                .attr("id", (d, j) => `pfam-details-orf-${idx}-${j}-tooltip`)
                .html((d) => generateTooltip(d, orf));
        $(`.${DOMAIN_CLASS}-tooltip .clipboard-copy`).off("click").click(copyToClipboard);
    }
    // label as selector as per viewer
    $(`.${DOMAIN_CLASS}-orflabel`).off("click").click(function(this: HTMLElement, event: JQuery.Event<HTMLElement, null>) {
        $(`#${locusToFullId($(this).attr("data-locus") || "none")}-svgeneorf`).trigger(event);
    });
    d3selectAll("g.domain-group").data(region.pfamOrfs);
    init();
    redrawPfamDomains();
}

function generateTooltip(domain: IPfamDomain, orf: IPfamsOrf) {
    const url = `https://pfam.xfam.org/family/${domain.accession}`;
    const link = `<a class='external-link' target='_blank' href="${url}">${domain.accession}</a>`;
    let html = `${link} - ${domain.name}<br>`;
    html += `Location: ${domain.start}-${domain.end} AA<br>`;
    html += `Score: ${domain.score}, E-Value: ${domain.evalue}<br>`;
    html += `${domain.description}<br><br>`;
    if (domain.go_terms.length > 0) {
        html += "Gene Ontologies:<br>";
        for (const go of domain.go_terms) {
            html += `&nbsp;${go}<br>`;
        }
        html += "<br>";
    }
    html += `AA sequence: ${clipboardCopyConstruct(domain.translation)}<br>`;

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
    $(`.${DOMAIN_CLASS}-domain`).click(tooltipHandler);
}

export function redrawPfamDomains() {
    if ($(`input.domains-selected-only`).prop("checked")) {
        $(`.${DOMAIN_CLASS}-svg`).hide();
        $(`.${DOMAIN_CLASS}-svg-singles`).show();
    } else {
        $(`.${DOMAIN_CLASS}-svg`).show();
        $(`.${DOMAIN_CLASS}-svg-singles`).hide();
    }
}

/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {scaleLinear as d3scaleLinear} from "d3-scale";
import {select as d3select} from "d3-selection";

import {IDomain, IOrf, IRegion} from "./dataStructures.js";

let activeTooltip: JQuery<HTMLElement> | null;

const jsdomain = {
    text_height: 14,
    unique_id: 0,
    version: "0.0.1",
};

export function drawDomains(id: string, region: IRegion, height: number): void {
    const container = d3select(`#${id}`);
    const singleOrfHeight = height;
    const interOrfPadding = 10;
    const width = $(`#${id}`).parent().width() || 700;
    container.selectAll("svg.jsdomain-svg").remove();
    const realHeight = (singleOrfHeight + interOrfPadding) * region.orfs.length + 10;
    const chart = container.append("svg")
        .attr("height", realHeight)
        .attr("width", "100%")
        .attr("viewbox", `-1 -1 ${width} ${realHeight}`)
        .attr("class", "jsdomain-svg");

    let maxOrfLength = 0;
    let maxOrfName = 0;
    for (const orf of region.orfs) {
        maxOrfLength = Math.max(maxOrfLength, orf.sequence.length);
        maxOrfName = Math.max(maxOrfName, orf.id.length);
    }


    const x = d3scaleLinear()
      .domain([1, maxOrfLength])
      .range([maxOrfName * 10, width]);  // allows space for labels

    for (let i = 0; i < region.orfs.length; i++) {
        const orf = region.orfs[i];
        const idx = jsdomain.unique_id++;
        const currentOrfY = (singleOrfHeight + interOrfPadding) * i + 2; // +2 to fit the first

        if (i % 2 == 1) {  // alternate background colour
            chart.append("rect")
                .attr("x", 0)
                .attr("y", currentOrfY - interOrfPadding / 2)
                .attr("width", width)
                .attr("height", singleOrfHeight + interOrfPadding)
                .attr("fill", "#f1f1f1")
                .attr("stroke-width", 0);
        }
        const text = chart.append("text")
            .text(orf.id)
            .attr("x", 0)
            .attr("y", currentOrfY + height * 0.7)
            .attr("class", "jsdomain-orflabel");

        const group = chart.append("g");
        group.append("line")
          .attr("x1", x(0))
          .attr("y1", currentOrfY + (height / 2))
          .attr("x2", x(orf.sequence.length))
          .attr("y2", currentOrfY + (height / 2))
          .attr("class", "jsdomain-line");

        group.selectAll("rect.jsdomain-domain")
            .data(orf.domains)
        .enter().append("rect")
            .attr("x", (d) => x(d.start))
            .attr("y", currentOrfY)
            .attr("rx", 17)
            .attr("ry", 17)
            .attr("width", (d) => x(d.end) - x(d.start))
            .attr("height", singleOrfHeight)
            .attr("id", (d, j) => `details-orf-${idx}-${j}-domain`)
            .attr("class", "jsdomain-domain ")
            .attr("fill", (d) => getFillColor(d.type))
            .attr("stroke", (d) => getStrokeColor(d.type))
            .attr("stroke-width", 1);

        group.selectAll("text.jsdomain-text")
            .data(orf.domains)
        .enter().append("text")
            .text((d) => getLabel(d.type))
            .attr("x", (d) => x((d.start + d.end) / 2))
            .attr("text-anchor", "middle")
            .attr("y", currentOrfY + height * 0.7)
            .attr("id", (d, j) => `details-orf-${idx}-${j}-text`)
            .attr("class", "jsdomain-text")
            .attr("font-size", jsdomain.text_height)
            .attr("font-weight", "bold");

        const toolGroup = container.append("div").attr("id", `details-orf-${idx}`);
        toolGroup.selectAll("div.jsdomain-tooltip")
            .data(orf.domains)
        .enter().append("div")
            .attr("class", "jsdomain-tooltip")
            .attr("id", (d, j) => `details-orf-${idx}-${j}-tooltip`)
            .html((d) => generateTooltip(d, orf));
    }
    init();
}

function getStrokeColor(type: string): string {
    switch (type) {
        case "AMP-binding":
        case "AOX":
            return "rgb(87,22,128)";
        case "PCP":
        case "ACP":
            return "rgb(11,78,199)";
        case "Cglyc":
        case "CXglyc":
        case "Condensation_DCL":
        case "Condensation_LCL":
        case "Condensation_Starter":
        case "Condensation_Dual":
        case "Heterocyclization":
            return "rgb(59,59,140)";
        case "Epimerization":
            return "rgb(59,59,140)";
        case "NRPS-COM_Nterm":
        case "NRPS-COM_Cterm":
        case "PKS_Docking_Nterm":
        case "PKS_Docking_Cterm":
        case "Trans-AT_docking":
            return "rgb(71,71,159)";
        case "Thioesterase":
        case "TD":
            return "rgb(119,3,116)";
        case "PKS_KS":
            return "rgb(9,179,9)";
        case "PKS_AT":
            return "rgb(221,6,6)";
        case "PKS_KR":
            return "rgb(10,160,76)";
        case "PKS_DH":
        case "PKS_DH2":
        case "PKS_DHt":
            return "rgb(186,103,15)";
        case "PKS_ER":
            return "rgb(12,161,137)";
        case "Aminotran_1_2":
        case "Aminotran_3":
        case "Aminotran_4":
        case "Aminotran_5":
        case "Polyketide_cyc2":
        default:
            return "rgb(147,147,147)";
    }
}

function getFillColor(type: string): string {
    switch (type) {
        case "AMP-binding":
        case "AOX":
            return "rgb(188,127,245)";
        case "PCP":
        case "ACP":
            return "rgb(129,190,247)";
        case "Cglyc":
        case "CXglyc":
        case "Condensation_DCL":
        case "Condensation_LCL":
        case "Condensation_Starter":
        case "Condensation_Dual":
        case "Heterocyclization":
            return "rgb(129,129,247)";
        case "Epimerization":
            return "rgb(129,129,247)";
        case "NRPS-COM_Nterm":
        case "NRPS-COM_Cterm":
        case "PKS_Docking_Nterm":
        case "PKS_Docking_Cterm":
        case "Trans-AT_docking":
            return "rgb(128,128,245)";
        case "Thioesterase":
        case "TD":
            return "rgb(245,196,242)";
        case "PKS_KS":
            return "rgb(129,247,129)";
        case "PKS_AT":
            return "rgb(247,129,129)";
        case "PKS_KR":
            return "rgb(128,246,128)";
        case "PKS_DH":
        case "PKS_DH2":
        case "PKS_DHt":
            return "rgb(247,190,129)";
        case "PKS_ER":
            return "rgb(129,247,243)";
        case "Aminotran_1_2":
        case "Aminotran_3":
        case "Aminotran_4":
        case "Aminotran_5":
        case "Polyketide_cyc2":
        default:
            return "rgb(218,218,218)";
    }
}

function getLabel(type: string): string {
    switch (type) {
        case "AMP-binding":
        case "AOX":
            return "A";
        case "PCP":
        case "ACP":
        case "NRPS-COM_Nterm":
        case "NRPS-COM_Cterm":
        case "PKS_Docking_Nterm":
        case "PKS_Docking_Cterm":
        case "Trans-AT_docking":
        case "Aminotran_1_2":
        case "Aminotran_3":
        case "Aminotran_4":
        case "Aminotran_5":
        case "Polyketide_cyc":
        case "Polyketide_cyc2":
        case "TIGR01720":
        case "TIGR02353":
            return "";
        case "Cglyc":
        case "CXglyc":
        case "Condensation_DCL":
        case "Condensation_LCL":
        case "Condensation_Starter":
        case "Condensation_Dual":
        case "Heterocyclization":
            return "C";
        case "Epimerization":
            return "E";
        case "Thioesterase":
            return "TE";
        case "PKS_KS":
            return "KS";
        case "PKS_AT":
            return "AT";
        case "PKS_KR":
            return "KR";
        case "PKS_DH":
        case "PKS_DH2":
            return "DH";
        case "PKS_DHt":
            return "DHt";
        case "PKS_ER":
            return "ER";
        default:
            return type.split("_")[0];
    }
}

function generateTooltip(domain: IDomain, orf: IOrf) {
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
    html += `AA sequence: <a href="javascript:copyToClipboard(${domain.sequence}')">Copy to clipboard</a><br>`;
    if (domain.dna_sequence) {
        html += 'Nucleotide sequence: <a href="javascript:copyToClipboard';
        html += `('${domain.dna_sequence}')">Copy to clipboard</a><br>`;
    }

    return html;
}

function tooltipHandler(this: HTMLElement, ev: JQuery.Event) {
    // hide any existing one
    const id = $(this).attr("id");
    if (typeof id === "undefined") {
        // we can't handle this
        return;
    }
    const tooltip = $(`#${id.replace("-domain", "-tooltip")}`);
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
    tooltip.css("left", offset.left + 10);
    const thisParent = $(this).parent();
    const numChildren = Math.min(thisParent.children("line").length, 1);
    let height = thisParent.height();
    if (typeof height === "undefined") {
        height = 0;
    }
    const topOffset = height / (numChildren * 2);
    let timeout = setTimeout(() => tooltip.slideUp("fast"), 5000);
    tooltip.css("top", offset.top + 30)
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
